# Child — Game lobby

**Screen ID:** C-GAME-LOBBY
**Owner:** Game Engine Lead + Frontend Lead
**Review:** Child Experience + Safety + QA

## Purpose
Let a child enter an approved game with friends or a team without exposing private contact data.

## Data
Available games, approved participants, invitation status, readiness, age band and session rules.

## Actions
«Присоединиться» → join command; «Пригласить» → approved friend/game invite; «Выйти» → leave command; «Правила» → child-friendly explanation.

## States
Waiting, ready, participant joined, full, declined, cancelled, reconnecting, finished.

## Safety
Only permitted participants appear. No unrestricted search for children. Group access is checked by backend.

## Acceptance
A child can enter and leave a safe session, see who may participate and recover from a disconnected session without losing authoritative results.
