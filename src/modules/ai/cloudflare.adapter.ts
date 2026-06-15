import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Subscriber } from 'rxjs';
import { buildSystemPrompt } from '../../common/constants/ai.constants';

export interface CloudflareToolCall {
  index?: number;
  id?: string;
  type?: string;
  function: {
    name?: string;
    arguments: string | Record<string, unknown>;
  };
}

export interface CloudflareAiResponse {
  result?: {
    choices?: {
      message?: {
        content?: string;
        tool_calls?: CloudflareToolCall[];
      };
    }[];
    response?: string;
    tool_calls?: CloudflareToolCall[];
  };
}

export interface CloudflareStreamChunk {
  choices?: {
    delta?: {
      content?: string;
      tool_calls?: CloudflareToolCall[];
    };
  }[];
  response?: string;
  result?: {
    response?: string;
    tool_calls?: CloudflareToolCall[];
  };
  tool_calls?: CloudflareToolCall[];
}

export interface ChatMessage {
  role: string;
  content: string | null;
  tool_calls?: CloudflareToolCall[];
  tool_call_id?: string;
}

export interface AiTool {
  type: string;
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

export type ToolExecutorFn = (name: string, args: Record<string, unknown>) => Promise<unknown>;

type AiProviderName = 'cloudflare' | 'groq';

interface AiProviderConfig {
  name: AiProviderName;
  label: string;
  url: string;
  token: string;
  model: string;
}

@Injectable()
export class CloudflareAdapter {
  private readonly logger = new Logger(CloudflareAdapter.name);
  private readonly providers: AiProviderConfig[];
  private providerCursor = 0;

  constructor(private configService: ConfigService) {
    const accountId = this.configService.get<string>('CLOUDFLARE_ACCOUNT_ID', '');
    const cloudflareModel = this.configService.get<string>(
      'CLOUDFLARE_AI_MODEL',
      '@cf/google/gemma-4-26b-a4b-it',
    );
    const groqModel = this.configService.get<string>('GROQ_AI_MODEL', 'llama-3.3-70b-versatile');

    const cloudflareProviders = accountId
      ? this.getEnvList('CLOUDFLARE_API_TOKENS', 'CLOUDFLARE_API_TOKEN').map((token, index) => ({
          name: 'cloudflare' as const,
          label: `cloudflare#${index + 1}`,
          url: `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/${cloudflareModel}`,
          token,
          model: cloudflareModel,
        }))
      : [];

    const groqProviders = this.getEnvList('GROQ_API_KEYS', 'GROQ_API_KEY').map((token, index) => ({
      name: 'groq' as const,
      label: `groq#${index + 1}`,
      url: 'https://api.groq.com/openai/v1/chat/completions',
      token,
      model: groqModel,
    }));

    this.providers = this.orderProviders([...cloudflareProviders, ...groqProviders]);
  }

  async processChat(
    historyMessages: ChatMessage[],
    userMessage: string,
    subscriber: Subscriber<unknown>,
    tools: AiTool[],
    executeTool: ToolExecutorFn,
  ) {
    if (this.providers.length === 0) {
      subscriber.next({ text: 'Hệ thống AI chưa được cấu hình.' });
      subscriber.complete();
      return;
    }

    const messages: ChatMessage[] = [
      {
        role: 'system',
        content: buildSystemPrompt(),
      },
    ];

    for (const msg of historyMessages) {
      messages.push({
        role:
          msg.role?.toLowerCase() === 'assistant' || msg.role?.toLowerCase() === 'model'
            ? 'assistant'
            : 'user',
        content: msg.content ?? '',
      });
    }
    messages.push({ role: 'user', content: userMessage });

    const MAX_TOOL_TURNS = 6;

    try {
      for (let turn = 0; turn < MAX_TOOL_TURNS; turn++) {
        this.logger.log(`AI turn ${turn + 1}...`);

        const response = await this.callAiStreamWithFallback(messages, tools);

        if (!response.body) {
          throw new Error('Response body is null');
        }

        const decoder = new TextDecoder();
        let buffer = '';
        let fullContent = '';
        let toolCalls: CloudflareToolCall[] = [];

        const reader = (response.body as ReadableStream<Uint8Array>).getReader();

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          let shouldStop = false;
          for (const line of lines) {
            const trimmedLine = line.trim();
            if (!trimmedLine) continue;
            if (trimmedLine === 'data: [DONE]') {
              shouldStop = true;
              break;
            }

            if (trimmedLine.startsWith('data: ')) {
              try {
                const json = JSON.parse(trimmedLine.substring(6)) as CloudflareStreamChunk;

                // Extract text - handle both delta content and full response chunks
                let delta = '';
                const choiceDelta = json.choices?.[0]?.delta?.content;
                const fullResp = json.response || json.result?.response;

                if (choiceDelta) {
                  delta = choiceDelta;
                } else if (fullResp) {
                  // If model sends full response so far, calculate only the new part
                  delta = fullResp.substring(fullContent.length);
                }

                if (delta) {
                  fullContent += delta;
                  subscriber.next({ text: delta });
                }

                const toolCallDelta =
                  json.choices?.[0]?.delta?.tool_calls ||
                  json.result?.tool_calls ||
                  json.tool_calls;

                if (toolCallDelta && Array.isArray(toolCallDelta)) {
                  for (const tc of toolCallDelta) {
                    const index = tc.index ?? 0;
                    const existingTc = toolCalls[index];

                    if (!existingTc) {
                      toolCalls[index] = {
                        index: index,
                        id: tc.id || '',
                        type: tc.type || 'function',
                        function: {
                          name: tc.function?.name || '',
                          arguments: tc.function?.arguments || '',
                        },
                      };
                    } else {
                      if (tc.id) existingTc.id = tc.id;
                      if (tc.type) existingTc.type = tc.type;
                      if (tc.function?.name) {
                        existingTc.function.name = tc.function.name;
                      }
                      if (tc.function?.arguments) {
                        const currentArgs = existingTc.function.arguments;
                        const newArgs = tc.function.arguments;
                        if (typeof currentArgs === 'string' && typeof newArgs === 'string') {
                          existingTc.function.arguments = currentArgs + newArgs;
                        } else if (typeof newArgs === 'string') {
                          existingTc.function.arguments = newArgs;
                        }
                      }
                    }
                  }
                }
              } catch (e) {
                this.logger.error(`Error parsing streaming JSON: ${trimmedLine}`, e);
              }
            }
          }

          if (shouldStop) {
            // Cancel the reader to close the connection immediately
            await reader.cancel();
            break;
          }
        }

        // Filter out empty or incomplete tool calls
        toolCalls = toolCalls.filter((tc) => tc && tc.function && tc.function.name);

        this.logger.log(
          `Stream complete. Content length: ${fullContent.length}, Tool calls: ${toolCalls.length}`,
        );

        if (toolCalls && toolCalls.length > 0) {
          messages.push({
            role: 'assistant',
            content: fullContent || null,
            tool_calls: toolCalls,
          });

          await Promise.all(
            toolCalls.map(async (tc: CloudflareToolCall) => {
              let args: Record<string, unknown> = {};
              try {
                args =
                  typeof tc.function.arguments === 'string'
                    ? (JSON.parse(tc.function.arguments) as Record<string, unknown>)
                    : tc.function.arguments;
              } catch {
                // Ignore parse errors
              }

              const toolName = tc.function.name || '';
              const result = await executeTool(toolName, args);

              messages.push({
                role: 'tool',
                tool_call_id: tc.id || toolName,
                content: JSON.stringify(result),
              });
            }),
          );
          // Continue to next turn
        } else {
          subscriber.complete();
          return;
        }
      }

      subscriber.next({ text: 'Xin lỗi, tôi không thể xử lý yêu cầu này do quá giới hạn nội bộ.' });
      subscriber.complete();
    } catch (err) {
      this.logger.error('Error calling AI provider:', err);
      subscriber.next({ error: 'Lỗi kết nối tới AI Model.' });
      subscriber.complete();
    }
  }

  private async callAiStreamWithFallback(messages: ChatMessage[], tools?: AiTool[]) {
    const providers = this.getProviderRotation();
    let lastError: unknown;

    for (const provider of providers) {
      try {
        this.logger.log(`Calling AI provider ${provider.label}`);
        return await this.callProviderStream(provider, messages, tools);
      } catch (error) {
        lastError = error;
        this.logger.warn(`AI provider ${provider.label} failed, trying next provider`);
      }
    }

    throw lastError instanceof Error ? lastError : new Error('Không còn provider AI khả dụng');
  }

  private async callProviderStream(
    provider: AiProviderConfig,
    messages: ChatMessage[],
    tools?: AiTool[],
  ): Promise<Response> {
    const body = this.buildRequestBody(provider, messages, tools);

    const response = await fetch(provider.url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${provider.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorData = await response.text();
      this.logger.error(`${provider.label} API error: ${response.status} - ${errorData}`);
      throw new Error(`${provider.label} API error: ${response.status}`);
    }

    return response;
  }

  private buildRequestBody(
    provider: AiProviderConfig,
    messages: ChatMessage[],
    tools?: AiTool[],
  ): Record<string, unknown> {
    const body: Record<string, unknown> = {
      messages: this.buildProviderMessages(provider, messages),
      stream: true,
    };

    if (provider.name === 'groq') {
      body.model = provider.model;
    }

    if (tools && tools.length > 0) {
      body.tools = tools;
    }

    return body;
  }

  private buildProviderMessages(provider: AiProviderConfig, messages: ChatMessage[]) {
    if (provider.name !== 'groq') {
      return messages;
    }

    return messages.map((message) => {
      const normalized: Record<string, unknown> = {
        role: message.role,
        content: message.content,
      };

      if (message.tool_call_id) {
        normalized.tool_call_id = message.tool_call_id;
      }

      if (message.tool_calls?.length) {
        normalized.tool_calls = message.tool_calls.map((toolCall) => ({
          id: toolCall.id || toolCall.function.name || 'tool_call',
          type: toolCall.type || 'function',
          function: {
            name: toolCall.function.name || '',
            arguments:
              typeof toolCall.function.arguments === 'string'
                ? toolCall.function.arguments
                : JSON.stringify(toolCall.function.arguments),
          },
        }));
      }

      return normalized;
    });
  }

  private getProviderRotation() {
    const providers = [...this.providers];
    const start = this.providerCursor % providers.length;
    this.providerCursor = (this.providerCursor + 1) % providers.length;

    return [...providers.slice(start), ...providers.slice(0, start)];
  }

  private getEnvList(pluralKey: string, singleKey: string) {
    const pluralValue = this.configService.get<string>(pluralKey, '');
    const singleValue = this.configService.get<string>(singleKey, '');
    const rawValue = pluralValue || singleValue;

    return rawValue
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean);
  }

  private orderProviders(providers: AiProviderConfig[]) {
    const order = this.configService
      .get<string>('AI_PROVIDER_ORDER', 'cloudflare,groq')
      .split(',')
      .map((value) => value.trim().toLowerCase())
      .filter((value): value is AiProviderName => value === 'cloudflare' || value === 'groq');

    if (order.length === 0) {
      return providers;
    }

    return providers.sort((a, b) => {
      const left = order.indexOf(a.name);
      const right = order.indexOf(b.name);
      return (left === -1 ? order.length : left) - (right === -1 ? order.length : right);
    });
  }
}
