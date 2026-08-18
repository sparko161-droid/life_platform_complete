# Wave Gate Protocol

## Purpose

A wave is a coherent delivery unit. Its completion must be validated as a system, not inferred from the statuses of its child tasks.

## Entry

- wave scope and outcome are approved;
- dependencies are classified;
- primary/reviewer/gate ownership is complete;
- required contracts are frozen.

## Exit

A wave may become `DONE` only when:

1. all mandatory tasks are `DONE`;
2. no blocking discovery/human decision remains;
3. integration tests across task boundaries pass;
4. Architecture Control Lead completes a Wave Gate review;
5. security/child-safety/adversarial/scale gates required by the wave pass;
6. documentation and traceability are updated;
7. a versioned review artifact records the result and follow-ups.

## Review artifact and its checks

Item 7 above -- "a versioned review artifact records the result and
follow-ups" -- is a file, not a convention:
`tasks/reviews/W<N>.yaml`, one per wave, plus `PHASE-1.yaml` for the Phase
Architecture Control Gate. `docs/planning/phase-1-review-artifact-template.md`
stays the prose template a reviewer works through; the YAML holds the part
a tool can verify. `pnpm run control:validate` (`task-registry control
validate`, wired into CI) enforces:

- a wave whose status is `DONE` or whose exit is `PASS` has an artifact,
  and that artifact decided `PASS`;
- an artifact that decided `PASS` is not contradicted by the task registry
  (every scoped task is `DONE`) or by an open blocker that still blocks the
  wave;
- every evidence area from the template is accounted for -- `NOT_REQUIRED`
  is a valid answer, but only with a note saying why;
- an artifact that decided `PASS` carries no `REWORK`/`BLOCKED` area or
  architecture-control check;
- scoped and follow-up task ids exist.

What it cannot check is whether a human actually reviewed the diff. It
checks that the claims made are consistent with the rest of the repository,
which is the failure mode BLK-P1-011 was raised for: a wave marked passed
with nothing behind it.

## Status authority

Wave status is independently stored from task status. A wave may be `BLOCKED` even when all currently scoped tasks are `DONE` if the Wave Gate has failed.
