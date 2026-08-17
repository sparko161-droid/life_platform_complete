# Human Decisions Queue

## D-001 — API ORM/data-access strategy
Options: Prisma / Drizzle / TypeORM / SQL-first repositories.
Recommendation: choose based on generated SQL control, migration quality and AI-agent ergonomics; prototype before final ADR.

## D-002 — Git hosting
Recommendation: GitHub/GitLab based on preferred CI and access control.

## D-003 — Task/AI team tracker
Recommendation: initially keep source-of-truth task state in Git + YAML/Markdown, then connect a UI/issue tracker after workflow stabilizes.

## D-004 — iOS build node
Recommendation: Mac mini/macOS CI runner or trusted hosted macOS CI with dedicated signing.
