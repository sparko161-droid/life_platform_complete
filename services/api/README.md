# services/api

Bootstrap placeholder. Implementation is blocked until the corresponding domain task is Ready.

## Database migrations

`node-pg-migrate` — see `docs/architecture/data-architecture.md` ("Migrations") for the choice rationale.

```bash
pnpm --filter @life/services-api run migrate:up
pnpm --filter @life/services-api run migrate:down
pnpm --filter @life/services-api run migrate:create -- <name>
```

Or from the repo root: `pnpm db:migrate:up` / `pnpm db:migrate:down`.
Requires `DATABASE_URL` (see `.env.example`); defaults match
`docker-compose.dev.yml`'s dev stack (P0-002).
