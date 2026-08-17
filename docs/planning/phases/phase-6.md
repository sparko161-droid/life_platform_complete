# Phase 6 — Games, Marketplace and Community

## Objective
Add cooperative/competitive games and the reusable case/template economy.

## Core domains

Game sessions, teams, matchmaking, task cases, template catalog, recommendations, family challenges, moderation.

## Mechanics
Cooperative sessions have lobby, ready, start, reconnect, timeout and settlement states. Cases preserve provenance; applying a case creates a family copy. Catalog ranking cannot be driven only by popularity and must resist spam/manipulation.

## Streams
G1 Game runtime, G2 cooperative game, G3 competitive game, G4 catalog, G5 cases, G6 recommendations, G7 community moderation.

## Contract gate
Game session state, case/template versioning, moderation state and recommendation signals freeze before client/game integrations.

## Exit criteria
A family can discover a moderated case, inspect why it is recommended, apply it to a child without mutating the source, and children can safely join a simple cooperative game that recovers from reconnect/timeout.