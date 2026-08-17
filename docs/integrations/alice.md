# Alice Integration

**Status:** Planned / feasibility validated
**Owner:** Integrations Lead

## Goal

Let household users interact with Life through an Alice skill, especially for task status, reminders where supported, voice learning and account-linked private data.

## Architecture

Alice Skill → OAuth/account linking → Life API.

## Candidate commands

- what are today's tasks?
- what is my next task?
- how much XP do I have?
- start learning session
- remind me about task

## Security

Private data requires account linking. Access to child data is scoped to the linked parent/device policy.

## Current platform anchor

Yandex Dialogs supports skills, backend webhooks and OAuth 2.0 account linking. Official docs state that account linking can be available on smart speakers and other supported surfaces.

## Sources

https://yandex.ru/dev/dialogs/alice/
https://yandex.ru/dev/dialogs/alice/doc/ru/auth/how-it-works
https://yandex.ru/dev/dialogs/alice/doc/ru/auth/when-to-use
