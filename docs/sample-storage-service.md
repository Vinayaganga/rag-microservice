# Storage Service Overview

The storage service handles file uploads, downloads, and lifecycle
management for user-uploaded content (images, documents, exports).

## Upload Retries

Failed uploads (e.g. due to a dropped connection mid-transfer) are retried
up to **4 times** with **exponential backoff** starting at 3 seconds (3s,
6s, 12s, 24s). After the 4th failure, the upload is marked failed and the
client is shown an error with a manual retry button.

## Storage Quota Rate Limiting

Each account can perform up to **200 upload operations per minute**
regardless of file size. Exceeding this returns a `429` and the client SDK
waits for the `Retry-After` header before resending.

## Retention

Deleted files are soft-deleted and recoverable for 14 days before being
permanently purged.
