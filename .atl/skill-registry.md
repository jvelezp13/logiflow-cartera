# Skill Registry — logiflow-cartera

Generated: 2026-04-03

## Project Conventions

| Source | Path | Description |
|--------|------|-------------|
| CLAUDE.md (project) | `CLAUDE.md` | Project instructions, stack, architecture, conventions, business rules |
| CLAUDE.md (user) | `~/.claude/CLAUDE.md` | User preferences, personality, global rules, SDD orchestrator |

## User Skills

| Skill | Trigger | Path |
|-------|---------|------|
| supabase-cli | SQL, queries, schema, migrations, DB operations | `~/.claude/skills/supabase-cli/SKILL.md` |
| branch-pr | Creating PRs, preparing changes for review | `~/.claude/skills/branch-pr/SKILL.md` |
| issue-creation | Creating GitHub issues, bug reports, feature requests | `~/.claude/skills/issue-creation/SKILL.md` |
| judgment-day | Adversarial dual review, "judgment day", "doble review" | `~/.claude/skills/judgment-day/SKILL.md` |
| go-testing | Go tests, Bubbletea TUI testing (N/A for this project) | `~/.claude/skills/go-testing/SKILL.md` |

## SDD Skills (auto-managed)

sdd-init, sdd-explore, sdd-propose, sdd-spec, sdd-design, sdd-tasks, sdd-apply, sdd-verify, sdd-archive, sdd-onboard

## Compact Rules

### supabase-cli
- Use `psql` and `supabase` CLI for DB access, NOT MCP
- Get service_role key via: `supabase projects api-keys --project-ref reaahmkrqxpbvnmrwhrt`
- Anon key cannot read RLS-protected tables without auth session
- Project ref: `reaahmkrqxpbvnmrwhrt`

### branch-pr
- Follow issue-first enforcement: every PR needs an issue
- Use `gh` CLI for PR creation
- Follow conventional commits

### issue-creation
- Follow issue-first enforcement system
- Use `gh` CLI for issue creation
- Include labels and proper categorization

### judgment-day
- Launch two independent blind judge sub-agents in parallel
- Synthesize findings, apply fixes, re-judge until both pass
- Escalate after 2 iterations if still failing

### Project Stack Rules (from CLAUDE.md)
- Server Components by default, Client Components only for interactivity
- State via URL searchParams, NOT useState for shared state
- Queries via `cartera-server.ts` and `alertas-server.ts`, NEVER directly
- React.cache() for deduplication, Promise.all() for parallel queries
- All queries filter by tenant_id (multi-tenant RLS)
- Prefer RPCs over direct queries for complex logic
- Names/types/variables in Spanish
- 3 roles: super_admin, admin, viewer; APP_ID = "cartera"
- Tailwind CSS v4 (config in globals.css, NO tailwind.config.ts)
- shadcn/ui (new-york style) in src/components/ui/ (do NOT edit manually)
- Vitest + Testing Library for tests
- No date-fns; use Intl.toLocaleDateString natively
