# Dependency Graph

## Critical path

A0/A1/A2 → B1/B2 → B3/B4 → C1/C2 → D1/D2/D3 → E1/E2/E3 → F1/F2/F3 → G1/G2.

## Parallel branches

- Media can progress alongside Task Engine once ownership and storage contracts exist.
- Parent UX and child UX can progress in parallel after API shapes are frozen.
- PWA game UI can progress while economy backend is implemented against mocked contracts.
- Social graph and messenger can start against finalized Identity/Family/Permission contracts.
- AI Gateway and Knowledge Base can start before final integrations.
- Catalog can start before games, using template/case contracts.

## Hard dependencies

Identity precedes family data. Family/permissions precede child social. Task/verification contracts precede camera tasks. Realtime foundation precedes messenger. Moderation precedes child messaging release. AI Gateway precedes AI assistant features.

## No hard dependency

AI avatar is not required for the first AI task assistant. Marketplace does not block core family product. iOS release does not block web/backend development.

## Sync checkpoints

Each phase publishes a versioned contract set. Dependent streams consume that version until a coordinated contract update is approved.
