# UI Architecture

**Owner:** UI/UX Lead
**Review:** Product, Child Experience, Frontend Lead

UI is a client presentation layer over canonical application contracts. Screens never own business rules.

## Surfaces
- Child PWA
- Parent Web
- Admin Web
- Flutter Android/iOS
- Telegram/MAX Mini Apps

## Modes
Child UI is game-first. Parent UI is control/insight-first. Admin UI is operation-first.

## Universal states
Every data-driven screen defines loading, empty, ready, partial, error, permission-denied, offline and stale-data states.

## Navigation
Every primary action has a destination, back behavior, cancellation behavior and post-success destination.

## Action contract
A button maps to a named application command/query, required capability, pending state, success event and failure presentation.

## Rule
A screen is not Done until its route, states, permissions, API dependency and downstream navigation are documented.