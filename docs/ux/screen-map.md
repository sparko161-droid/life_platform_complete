# Screen Map

**Owner:** UI/UX Lead
**Review:** Product + User Journey QA

## Child
`/child/today` → `/child/task/:id` → proof/verification → result → `/child/today`.
`/child/quests` → quest detail → task sequence → completion → rewards.
`/child/progress` → level/skills/streaks/achievements.
`/child/friends` → friend profile → challenge/game/chat.
`/child/chat/:id` → message → moderation/XP → conversation.
`/child/games` → lobby → session → result.

## Parent
`/parent/dashboard` → child summary → task/quest/reward detail.
`/parent/tasks` → builder → draft → preview → assignment.
`/parent/children/:id` → progress/history/policies.
`/parent/friends` → discovery → request → friendship → chat.
`/parent/cases` → case detail → copy/apply → child plan.
`/parent/settings` → permissions/devices/notifications/privacy.

## Admin
Users, families, content, moderation, analytics, feature flags, audit.

## Rule
Deep links must land in a state that can be safely refreshed and recovered from expired sessions.