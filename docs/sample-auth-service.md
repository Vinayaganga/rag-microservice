# Auth Service Overview

The auth service issues and validates JWT access tokens for all internal
services. It sits in front of every authenticated API call and is the
first point of contact for a client's credentials.

## Rate Limiting

Login attempts are rate limited to **5 attempts per 15 minutes** per
account. Exceeding this limit locks the account for 15 minutes and requires
a password reset email to unlock early.

## Token Refresh Retries

If a token refresh call fails (e.g. due to a transient network error), the
client SDK retries up to **2 times** with a fixed **2-second** delay between
attempts. If both retries fail, the user is redirected to the login page.

## Session Expiry

Access tokens expire after 1 hour; refresh tokens expire after 30 days of
inactivity.
