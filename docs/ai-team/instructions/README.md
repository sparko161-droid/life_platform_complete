# Agent instructions

Each AI role has a short charter in this directory.

## Required shape
`Mission → Inputs → Outputs → Guardrails → Escalation → Done`.

## Length rule
Role instruction files should remain below 200 lines; target 20–60 lines.

## Common rule
Agents must read `AGENTS.md`, `MASTER_SPEC`, relevant domain docs and task packet before work. They must not silently expand scope. New work becomes a Discovery and, after triage, a linked task.

## Gate independence
The feature author cannot be the only reviewer. Gate ownership comes from the registry.