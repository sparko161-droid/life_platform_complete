# AI Team Roles

**Status:** Foundation
**Owner:** AI CTO
**Depends on:** MASTER_SPEC
**Related:** MASTER_SPEC


## Leadership
AI CTO: orchestration, delivery health, escalation.
Chief Architect: system integrity, ADRs and foundational architecture decisions.
Architecture Control Lead: independent cross-wave and cross-phase integrity control.
Product Manager: product scope and acceptance criteria.
Roadmap Advisor: priority/dependency analysis.

## Delivery
Domain Architect: domain contracts.
Backend/Frontend/Mobile Leads: implementation strategy.
Game Engine Lead: gameplay and economy behavior.
AI/ML Lead: model integrations.
Computer Vision Lead: pose/verification.
Integrations Lead: Alice/Telegram/MAX/MCP.
UI/UX Lead: interface consistency.
Child Experience Lead: child-safe game UX.

## Assurance
QA Lead, Automated Test Agent, User Journey Agent, Security & Child Safety Agent (original combined role, still primary on tasks that predate the split below), Security Engineering, Child Safety Lead, Security Red Team, Performance/Scale Agent, Code Quality Agent, Documentation Agent.

## Security separation
Security Engineering prevents and detects security defects during design and implementation. Child Safety owns child-specific safety, consent and harm-prevention controls. Security Red Team is adversarial: it actively attempts authorization bypass, data isolation breaks, privilege escalation, replay, race, media access abuse, reward manipulation, API abuse and other realistic attack paths. A critical change must not have the same role both implementing the security boundary and acting as its sole adversarial validator. New Phase 1 work uses this split; earlier tasks that used the combined Security & Child Safety Agent role are not retroactively reassigned.

## Legal and privacy
Legal Counsel Lead: obligation register, consent and parental-rights model, retention/deletion/export requirements, privacy notice and terms source text. Privacy Engineering Lead: turns those obligations into enforced mechanisms with machine-checkable tests.

These are separate roles for the same reason Security Engineering and Security Red Team are: the role that writes an obligation must not be the sole judge of whether the code satisfies it. Legal Counsel prepares work for qualified external counsel and consumes its output; per docs/security/legal-ru.md it never states that the product is compliant.

## Cross-phase control
Architecture Control Lead does not implement the system and does not replace the Chief Architect. The role independently checks that code, contracts, events, dependencies, migrations, documentation and operational assumptions still describe one coherent architecture after a wave or phase. A failed architecture-control gate blocks phase exit until resolved or explicitly escalated to the Human Architect.

## Rule
Each role has a charter, inputs, outputs and explicit non-goals. The role cannot approve its own work as the sole gate. Assurance roles remain independent from the implementation they validate.
