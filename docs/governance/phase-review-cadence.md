# Phase and Wave Review Cadence

## Task review

Every active task follows the task lifecycle and mandatory gates.

## Wave review

After a coherent wave reaches implementation completion, the team performs a Wave Gate before opening the next dependent wave. The review is lightweight when no architecture boundary changed, but it is never skipped.

## Phase review

At the end of a phase, the project performs a full Architecture Control review across all waves. It is not a roll-up of task approvals.

## Revalidation triggers

An earlier phase must be re-opened for architecture review when a later change:

- changes a foundational contract;
- introduces a second source of domain truth;
- changes an event/version consumed by earlier code;
- requires migration of earlier authoritative data;
- changes a security boundary;
- invalidates a documented invariant.

## Principle

Quality control is deliberately hierarchical: task correctness protects local work; wave review protects integration; phase architecture control protects the coherence of the entire product over time.
