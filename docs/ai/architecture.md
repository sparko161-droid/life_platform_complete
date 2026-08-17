# AI Platform Architecture

**Status:** Foundation
**Owner:** AI CTO
**Depends on:** MASTER_SPEC
**Related:** MASTER_SPEC


## Components
AI Gateway, provider adapters, prompt registry, tool registry, Knowledge Base, evaluation suite, safety filters and cost telemetry.

## Provider neutrality
Domain code calls typed AI capabilities, not vendor SDKs.

## Tool access
AI receives least-privilege tools. Each tool maps to an application service and policy check.

## Memory
AI project memory is the documentation graph + ADRs + task artifacts. User conversational memory is a separate product concern.

## Human-in-the-loop
Task creation, real-money changes, child policy changes and public content publication require approved workflow.
