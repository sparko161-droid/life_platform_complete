# Backup and Disaster Recovery

**Status:** Foundation
**Owner:** AI CTO
**Depends on:** MASTER_SPEC
**Related:** MASTER_SPEC


## Backup targets
PostgreSQL, object metadata, critical configuration and release artifacts.

## RPO/RTO
Initial targets are proposed in the operational planning backlog and must be finalized before production. Product-critical family/task data requires stronger recovery than transient cache.

## Recovery tests
A backup is not considered valid until restore has been tested periodically.

### Local/non-production procedure (P0-checklist)

```bash
pnpm db:backup                        # -> backups/life-<timestamp>.dump (gitignored, local only)
pnpm db:restore backups/life-<timestamp>.dump
```

`scripts/db-backup.mjs`/`scripts/db-restore.mjs` shell out to
`docker compose exec` (`pg_dump --format=custom` / `pg_restore --clean
--if-exists`) so they work the same on any machine that already has
Docker for the P0-002 dev stack, no local `psql`/`pg_dump` install
required. `docker-compose.dev.yml` pins `name: life-platform` so these
commands find the stack regardless of which worktree directory they run
from (this repo's one-worktree-per-task convention makes Compose's
default directory-basename project naming unreliable otherwise — found
this for real while testing).

Verified end to end: seeded real data, `db:backup`, dropped the tables
entirely (`DROP TABLE ... CASCADE`), `db:restore`, confirmed the exact
pre-drop rows came back. Caught and fixed a real bug in the process: the
first version of `db-restore.mjs` used `execFile`'s `input` option to
feed the dump to `pg_restore`'s stdin -- that option only exists on the
`*Sync` variants, so it silently did nothing and the restore hung
forever. Rewritten with `spawn` and a real stdin pipe.

## Object storage
Enable versioning/lifecycle where available; protect against accidental deletion.

## Incident procedure
Detect → contain → restore service → verify integrity → communicate → postmortem → prevention task.
