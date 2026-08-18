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

## Status authority

Wave status is independently stored from task status. A wave may be `BLOCKED` even when all currently scoped tasks are `DONE` if the Wave Gate has failed.
