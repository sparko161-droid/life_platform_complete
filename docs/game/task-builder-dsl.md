# Task Builder DSL

**Owner:** Task/Domain Architect

Task is a versioned definition composed from blocks: `content`, `schedule`, `audience`, `prerequisites`, `verification`, `evidence`, `reward`, `progression`, `notifications`, `presentation`.

## Composition
A task may be simple or composite. Composite nodes support ordered, parallel and nested children.

## Completion predicates
`ALL`, `ANY`, `COUNT`, `SCORE`, `PARENT_DECISION`, `SEQUENCE`.

## Versioning
Global templates are immutable. Family edits create a local version linked to the source template.

## Validation
Builder validates age bounds, contradictory verification, reward permissions, schedule conflicts and missing dependencies before activation.

## Acceptance
A parent can compose a task without code, preview it, save draft, publish to a child and later edit a family copy without changing the global template.