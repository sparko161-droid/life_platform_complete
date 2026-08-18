# Wave / Phase Review Artifact Template

Use one copy per Wave Gate and one final copy for the Phase Architecture Control Gate.

## Identity

- Review ID:
- Scope: `W#` or `PHASE-1`
- Date:
- Reviewed commits/range:
- Primary reviewer:
- Architecture Control Lead:
- Human Architect decision owner:

## Evidence

| Area | Evidence | Status | Finding / follow-up task |
|---|---|---|---|
| Contracts | | | |
| Domain / state | | | |
| API | | | |
| Events | | | |
| Persistence / migrations | | | |
| Tests | | | |
| Security Engineering | | | |
| Security Red Team | | | |
| Child Safety | | | |
| Performance / Scale | | | |
| Observability / Audit | | | |
| Documentation / Traceability | | | |
| Technical debt | | | |

## Architecture Control

- Dependency direction still valid: PASS / REWORK / BLOCKED
- Single authoritative source of domain truth: PASS / REWORK / BLOCKED
- Contract/version compatibility: PASS / REWORK / BLOCKED
- Migration compatibility: PASS / REWORK / BLOCKED
- No undocumented breaking changes: PASS / REWORK / BLOCKED
- No duplicate bounded-domain implementation: PASS / REWORK / BLOCKED
- Later-phase concerns remain behind explicit boundaries: PASS / REWORK / BLOCKED

## Decision

`PASS` / `REWORK` / `BLOCKED`

### Accepted deviations

For each accepted deviation record:

- decision;
- risk;
- mitigation;
- owner;
- revisit/expiry condition;
- linked task/ADR.

### Follow-up tasks

List task IDs. Never silently expand the reviewed scope.
