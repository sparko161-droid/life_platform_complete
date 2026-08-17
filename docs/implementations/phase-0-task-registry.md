# Implementation: Phase 0 Task Registry

## Scope
Source-controlled task registry for AI work before external tracker integration.

## Inputs
Task contract, agent registry, dependency list, phase/workstream.

## Outputs
Status, owner, reviewer, gate owners, links, discoveries, decisions.

## Required capabilities
Claim, handoff, block, reassign, add discovery, create child task, close task.

## Storage
YAML/Markdown initially; tracker adapter later.

## Acceptance
A task can be claimed by one agent, moved through gates and linked to a new Discovery-created task without editing history.
