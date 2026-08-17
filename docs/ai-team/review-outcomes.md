# Review Outcomes

**Status:** Foundation

## Reviewer contract

A reviewer must provide evidence, not a vague request to "fix" work.

## Required review output

- result
- evidence
- impacted files/modules
- test evidence
- architecture evidence
- security/safety evidence
- discoveries
- rework items
- recommended next tasks

## Decision rules

A wrong implementation of accepted behavior is REWORK.

A missing feature that was never in the accepted scope is a DISCOVERY and may become a NEW TASK.

An architectural uncertainty that blocks safe implementation is BLOCKED.

A low-risk improvement that does not affect scope may be TECH_DEBT and should not block delivery unless severity says otherwise.

## Independent review

The author cannot be the only approver. At least one independent reviewer and required domain gates must pass.

## No silent scope expansion

Reviewers must not append new requirements to the current task without recording a Discovery.
