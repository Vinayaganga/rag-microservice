# Config Service Overview

The config service manages feature flags and remote configuration values
used to control rollouts without requiring a deploy.

## Flag Evaluation

Flags are evaluated client-side using a locally cached ruleset that's
refreshed every 60 seconds via a background poll. Evaluation is
deterministic per user ID, so the same user always gets the same variant
within a given experiment.

## Cache Invalidation

When a flag is updated in the admin console, connected clients receive a
push notification over a long-lived connection and refresh their local
cache within 5 seconds, without waiting for the next poll cycle.

## Audit Log

Every flag change is recorded in an audit log with the editor's identity,
timestamp, and a diff of the old vs. new ruleset, retained indefinitely.
