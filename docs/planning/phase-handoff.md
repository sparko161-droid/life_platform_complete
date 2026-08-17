# Phase Handoff and Contract Freeze

## Purpose
Make parallel development safe by freezing the contracts consumed by dependent streams.

## Required handoff package

Domain contract, API/OpenAPI version, event list, permission matrix, data migration notes, UI states, acceptance journeys, test fixtures and known limitations.

## Rules
A downstream stream may start against a frozen contract. Breaking changes require a new version, impact analysis and coordinated migration.

## Sync owner
AI CTO maintains the dependency board. Chief Architect resolves technical conflicts. Product Manager resolves scope conflicts. Human Architect resolves durable product/security/money decisions.

## Parallel example
Task Engine, Parent UX and Child UX can work simultaneously after Task DSL/API shapes are frozen. Media can proceed against storage contracts. Economy can use mocked GameEvents while task completion is built.

## Merge trains
Related changes merge through a contract-compatible sequence. Independent streams may merge separately when their integration tests pass.

## Discovery propagation
A finding in one stream becomes a Discovery. If it creates work for another stream, AI CTO creates a linked task with explicit dependency rather than silently expanding the original task.
