# Search Service Overview

The search service maintains a full-text index over all customer-facing
content and serves query requests for the main product search bar.

## Index Update Retries

When a document fails to index (e.g. the indexing worker crashes mid-write),
the update is retried up to **5 times** with a **linear backoff** of 2
seconds between each attempt (2s, 4s, 6s, 8s, 10s). If all 5 attempts fail,
the document is queued for a nightly reindex job instead of a dead-letter
queue.

## Query Latency

95th percentile query latency is targeted at under 150ms. Queries are
cached for 60 seconds per unique query string.

## Index Freshness

New or updated documents typically appear in search results within 30
seconds of being written, via a near-real-time indexing pipeline.
