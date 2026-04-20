---
trigger: always_on
---

# GEMINI.md — Healthmate Backend

> AI behavior rules for the `healthmate-be` NestJS project.

---

## CRITICAL: ALWAYS READ FIRST

Before ANY task in this project, you MUST:
1. Read `.agent/ARCHITECTURE.md` for system overview
2. Read `.agent/skills/healthmate-context/SKILL.md` for project conventions
3. Select the appropriate agent and announce it

---

## 📥 REQUEST CLASSIFIER

| Request Type | Active Agent | Key Skills |
|-------------|-------------|------------|
| New endpoint/feature | `backend-specialist` | `nestjs-expert`, `healthmate-context` |
| Schema/DB change | `database-architect` | `prisma-expert`, `healthmate-context` |
| Bug fix | `debugger` | `systematic-debugging` |
| Security review | `security-auditor` | `vulnerability-scanner` |
| Write tests | `test-engineer` | `testing-patterns` |
| Deploy/Docker | `devops-engineer` | `deployment-procedures` |
| Performance | `performance-optimizer` | `performance-profiling` |
| Planning | `project-planner` | `brainstorming`, `plan-writing` |

---

## 🤖 AGENT ROUTING (MANDATORY)

Before writing ANY code, complete this checklist:

| Step | Check |
|------|-------|
| 1 | Did I identify the correct agent for this task? |
| 2 | Did I read `healthmate-context/SKILL.md`? |
| 3 | Did I announce `🤖 Applying knowledge of @[agent]...`? |
| 4 | Did I load the domain skill (nestjs-expert / prisma-expert)? |

**Failure = Protocol Violation.**

---

## TIER 0: UNIVERSAL RULES (Always Active)

### Language

- Respond in **Vietnamese** when user writes in Vietnamese
- Code, comments, variable names always in **English**

### Socratic Gate (MANDATORY)

For **new features or complex changes**, STOP and ask before coding:
1. Chức năng cụ thể là gì?
2. Có ảnh hưởng đến module nào khác không?
3. Cần auth/ownership check không?

### Code Quality

- Follow `@[skills/clean-code]` rules
- No `any` types
- No `console.log` in production code
- Always `await` async operations
- Controller → Service → Prisma (never skip layers)

---

## TIER 1: BACKEND-SPECIFIC RULES

### Project Stack (FIXED — do not suggest alternatives)

- **Framework**: NestJS v11 (not Hono, not Express)
- **ORM**: Prisma v7 (not TypeORM, not Drizzle)
- **Database**: PostgreSQL (not SQLite, not MongoDB)
- **Language**: TypeScript 5.7 (strict)
- **Package Manager**: Yarn (not npm, not pnpm)

### Every New Module MUST Have

- [ ] DTOs with `class-validator` + `@ApiProperty()`
- [ ] `@UseGuards(JwtAuthGuard)` on protected routes
- [ ] Ownership check in service
- [ ] Swagger decorators on controller
- [ ] Registered in `AppModule`

### Verification After Every Change

```bash
yarn lint
npx tsc --noEmit
```

Both MUST pass before reporting done.

---

## TIER 2: SLASH COMMANDS

| Command | Purpose |
|---------|---------|
| `/new-module` | Scaffold new NestJS module |
| `/api-review` | Review endpoint quality |
| `/db-migrate` | Safe schema migration workflow |
| `/debug` | Systematic bug investigation |
| `/test` | Generate/run tests |
| `/plan` | Break down large task |
| `/brainstorm` | Explore design options |
| `/enhance` | Refactor/improve code |
| `/deploy` | Pre-deployment checklist |
| `/status` | Project status |

---

## 📁 QUICK REFERENCE

- **Agents**: `.agent/agents/`
- **Skills**: `.agent/skills/`
- **Workflows**: `.agent/workflows/`
- **Project context**: `.agent/skills/healthmate-context/SKILL.md`
- **NestJS patterns**: `.agent/skills/nestjs-expert/SKILL.md`
- **Prisma patterns**: `.agent/skills/prisma-expert/SKILL.md`

---

## RESPONSE FORMAT

When applying an agent:
```
🤖 **Applying knowledge of `@[agent-name]`...**

[Response continues]
```

Keep responses concise. Use Vietnamese when user writes in Vietnamese.
