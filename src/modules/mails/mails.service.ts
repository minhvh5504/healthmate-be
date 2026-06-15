import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';
import * as fs from 'fs';
import * as path from 'path';
import * as Handlebars from 'handlebars';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private resend: Resend | null = null;
  private mailFrom: string;
  private templates: Record<string, HandlebarsTemplateDelegate> = {};

  constructor(private configService: ConfigService) {
    this.initializeResend();
    this.loadTemplates();
  }

  private initializeResend() {
    const apiKey = this.configService.get<string>('RESEND_API_KEY');
    this.mailFrom = this.configService.get<string>('MAIL_FROM') || 'noreply@healthmate.dev';

    if (!apiKey) {
      this.logger.warn('RESEND_API_KEY not found. Emails will be logged to console only.');
      return;
    }

    this.resend = new Resend(apiKey);
    this.logger.log('Resend email service initialized');
  }

  /**
   * Load and compile Handlebars templates
   */
  private loadTemplates() {
    const templatesToLoad = [
      'verification-email',
      'welcome-email',
      'otp-email',
      'forgot-password-email',
      'connection-invitation',
    ];

    try {
      const templatesDir = path.join(__dirname, 'templates');

      for (const templateName of templatesToLoad) {
        const templatePath = path.join(templatesDir, `${templateName}.hbs`);
        if (fs.existsSync(templatePath)) {
          const source = fs.readFileSync(templatePath, 'utf-8');
          this.templates[templateName] = Handlebars.compile(source);
        } else {
          this.logger.warn(`Template not found: ${templatePath}`);
        }
      }
      this.logger.log('MailService templates loaded successfully');
    } catch (error) {
      this.logger.error('Failed to load email templates:', error);
    }
  }

  /**
   * Send verification email with OTP code
   */
  async sendVerificationEmail(email: string, fullName: string, code: string): Promise<void> {
    const subject = 'Verify Your Email - Healthmate';

    if (!this.templates['verification-email']) {
      this.logger.error('Verification email template not loaded');
      return;
    }

    const html = this.templates['verification-email']({ fullName, code });
    await this.sendMail(email, subject, html, fullName, code);
  }

  /**
   * Send welcome email after verification
   */
  async sendWelcomeEmail(email: string, fullName: string): Promise<void> {
    const subject = 'Welcome to Healthmate! 🎉';

    if (!this.templates['welcome-email']) {
      this.logger.error('Welcome email template not loaded');
      return;
    }

    const html = this.templates['welcome-email']({ fullName });
    await this.sendMail(email, subject, html, fullName);
  }

  /**
   * Send OTP email for registration (email-only flow)
   */
  async sendOtpEmail(email: string, code: string): Promise<void> {
    const subject = 'Mã xác thực đăng ký - Healthmate';

    if (!this.templates['otp-email']) {
      this.logger.error('OTP email template not loaded');
      return;
    }

    const html = this.templates['otp-email']({ code });
    await this.sendMail(email, subject, html, undefined, code);
  }

  /**
   * Send forgot password email with OTP code
   */
  async sendForgotPasswordEmail(email: string, fullName: string, code: string): Promise<void> {
    const subject = 'Quên mật khẩu - Healthmate';

    if (!this.templates['forgot-password-email']) {
      this.logger.error('Forgot password email template not loaded');
      return;
    }

    const html = this.templates['forgot-password-email']({ fullName, code });
    await this.sendMail(email, subject, html, fullName, code);
  }

  /**
   * Send connection invitation email
   */
  async sendConnectionInvitation(data: {
    toEmail: string | null;
    inviterName: string;
    inviterEmail: string | null;
    relationshipId: string;
    token: string;
  }): Promise<void> {
    if (!data.toEmail) {
      this.logger.warn('Cannot send connection invitation: toEmail is missing');
      return;
    }

    if (!this.templates['connection-invitation']) {
      this.logger.error('Connection invitation template not loaded');
      return;
    }

    try {
      const baseUrl = this.configService.get<string>('BASE_URL');
      const acceptUrl = `${baseUrl}/api/user-relationships/accept-token?token=${data.token}`;

      const html = this.templates['connection-invitation']({
        inviterName: data.inviterName,
        inviterEmail: data.inviterEmail || '',
        acceptUrl,
      });

      const subject = `🔗 Lời mời kết nối từ ${data.inviterName} - Healthmate`;

      await this.sendMail(data.toEmail, subject, html);
    } catch (error) {
      this.logger.error('Failed to send connection invitation email:', error);
    }
  }

  // Core method
  async sendMail(
    to: string,
    subject: string,
    html: string,
    fullName?: string,
    code?: string,
  ): Promise<void> {
    if (!this.resend) {
      this.logger.log(`
        📧 EMAIL (Console Mode)
        To: ${to}
        Subject: ${subject}
        ${fullName ? `Name: ${fullName}` : ''}
        ${code ? `OTP Code: ${code}` : ''}
      `);
      return;
    }

    try {
      const { error } = await this.resend.emails.send({
        from: this.mailFrom,
        to,
        subject,
        html,
      });

      if (error) {
        throw new Error(error.message);
      }

      this.logger.log(`Email sent successfully to ${to}`);
    } catch (error) {
      this.logger.error('Failed to send email:', error);
      this.logger.log(`
        📧 EMAIL (Fallback Mode)
        To: ${to}
        Subject: ${subject}
        ${fullName ? `Name: ${fullName}` : ''}
        ${code ? `OTP Code: ${code}` : ''}
      `);
    }
  }
}
