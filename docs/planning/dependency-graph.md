# Dependency Graph

## Critical path
A0/A1/A2/A4 → B1/B2 → B3/B4 → C1/C2 → D1/D2/D3 → E1/E2/E3/E4 → F1/F2/F3/F4/F5 → G1/G2/G3 → 7.

## Parallel branches
- Media can progress once storage/evidence contracts exist.
- Parent and child UX can progress in parallel against versioned APIs.
- Economy can use mocked completion/game events.
- Parent Social can start after Family/Permission contracts; it does not require Child Social.
- AI Gateway and KB can start before integrations.
- Marketplace content tooling can start before game runtime.

## Hard dependencies
Identity → Family. Family/permissions → social. Task/verification → camera tasks. Realtime/media → messenger. Moderation → child communication release. AI Gateway → AI assistant/integrations. Development Profile → evidence-backed recommendations.

## Contract handoff
Each phase publishes a versioned package containing domain/API/events/permissions/UI/test fixtures. Downstream streams consume that version until a coordinated migration is approved.

## Discovery propagation
A review finding outside the accepted scope creates a Discovery. If it affects another stream, AI CTO creates a linked task and dependency; the source task is not silently expanded.
