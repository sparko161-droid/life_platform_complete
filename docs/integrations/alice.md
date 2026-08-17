# Alice Integration

**Status:** Foundation
**Owner:** AI CTO
**Depends on:** MASTER_SPEC
**Related:** MASTER_SPEC


## Architecture
Alice Skill Adapter → Life API → authorized application services.

## Account linking
Official Alice documentation supports OAuth 2.0 account linking for access to protected user data. The skill receives the OAuth access token after linking. citeturn798336search0turn798336search5

## Supported surfaces
Current Alice authorization documentation lists Yandex iOS/Android apps, Yandex TV, smart speakers with Alice and Yandex Browser as supported surfaces for account-linked skills. citeturn798336search6

## Use cases
“What are my tasks?”, reminders, learning sessions, word practice, progress summaries.

## Safety
Do not expose child money, private chats or unrelated family data through voice without explicit policy and scope.

## Architecture rule
Alice is an adapter; it never writes business state without the same application services used by Web/Mobile.
