# Child — Task detail screen

**Screen ID:** C-TASK
**Owner:** Frontend Lead
**Review:** Task Architect + QA + Child Experience

## Purpose
Explain one task in plain Russian and guide the child to one clear completion path.

## Data
Task title, description, schedule, verification method, progress, reward preview, prerequisites and current attempt.

## Verification presentation
- manual: «Я сделал»;
- parent approval: «Отправить на проверку»;
- photo/video/audio: «Добавить подтверждение»;
- timer/counter: visible progress;
- camera exercise: «Начать тренировку».

## States
Ready, in progress, waiting for proof, verifying, approved, rejected with explanation, retryable failure, offline.

## Rules
Never expose codes, endpoint names or raw verification errors. Explain what the child can do next.

## Acceptance
Every action leads to a defined backend command/result and a deterministic next UI state.
