# Analytics Service Overview

The analytics service ingests product usage events from client SDKs and
aggregates them into dashboards used by the product and growth teams.

## Rate Limiting

Each API key is rate limited to **1,000 events per minute**. Events beyond
this limit are dropped (not queued or retried) and a `429` is returned to
the client SDK, which is expected to buffer and resend on its own schedule.

## Event Deduplication

Events are deduplicated by client-provided event ID within a rolling
24-hour window, using a Redis set with a 24-hour TTL per key.

## Dashboard Refresh

Aggregated dashboards refresh every 5 minutes; raw event data is retained
for 90 days before being archived to cold storage.
