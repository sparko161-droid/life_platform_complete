import type { Task } from "./schema.js";

export interface HandoffInput {
  task: Task;
  branch: string | null;
  files: string[];
  contracts: string[];
  tests: string[];
  risks: string[];
  decisions: string[];
  nextTasks: string[];
}

/**
 * Fixed handoff format per docs/ai-team/workflow.md ("goal, files, contracts,
 * tests, risks, decisions, next tasks") and AGENTS.md ("changed files,
 * contracts changed, tests run, known risks, follow-up tasks, and whether
 * any ADR is required").
 */
export function renderHandoff(input: HandoffInput): string {
  const list = (items: string[]) =>
    items.length > 0 ? items.map((i) => `- ${i}`).join("\n") : "- none";

  return `# Handoff — ${input.task.id} ${input.task.title}

## Goal
${input.task.title}

## Branch
${input.branch ?? "(not on a task branch)"}

## Files changed
${list(input.files)}

## Contracts changed
${list(input.contracts)}

## Tests run
${list(input.tests)}

## Known risks
${list(input.risks)}

## Decisions
${list(input.decisions)}

## Next tasks
${list(input.nextTasks)}

## ADR required
Note explicitly if this handoff represents a foundational decision needing an ADR under docs/adr/.
`;
}
