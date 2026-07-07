// Hand-written Q&A test cases against the sample docs in docs/.
// expectedSourceFile is used for a deterministic retrieval hit-check;
// null means the question is deliberately out of scope, so the system
// should abstain rather than hallucinate.

export const dataset = [
  {
    question: "What is the retry policy for failed notifications?",
    expectedSourceFile: "sample-notification-service.md",
  },
  {
    question: "How many notifications can a user receive per hour?",
    expectedSourceFile: "sample-notification-service.md",
  },
  {
    question: "What channels does the notification service deliver alerts through?",
    expectedSourceFile: "sample-notification-service.md",
  },
  {
    question: "What happens when a payment fails?",
    expectedSourceFile: "sample-billing-service.md",
  },
  {
    question: "How much does the Pro plan cost per month?",
    expectedSourceFile: "sample-billing-service.md",
  },
  {
    question: "How long is the grace period after a failed payment?",
    expectedSourceFile: "sample-billing-service.md",
  },
  {
    question: "What programming language is the notification service written in?",
    expectedSourceFile: null,
  },
  {
    question: "Does the billing service support cryptocurrency payments?",
    expectedSourceFile: null,
  },
  // Additional docs with deliberately overlapping vocabulary (rate limiting,
  // retries, backoff) but different specific numbers — these make the
  // vector-vs-hybrid retrieval comparison meaningful instead of trivial.
  {
    question: "What is the rate limit for login attempts on the auth service?",
    expectedSourceFile: "sample-auth-service.md",
  },
  {
    question: "How many times does the client retry a failed token refresh, and how long does it wait between attempts?",
    expectedSourceFile: "sample-auth-service.md",
  },
  {
    question: "How many times does the search service retry a failed index update?",
    expectedSourceFile: "sample-search-service.md",
  },
  {
    question: "What is the 95th percentile query latency target for search?",
    expectedSourceFile: "sample-search-service.md",
  },
  {
    question: "What is the rate limit per API key for the analytics service?",
    expectedSourceFile: "sample-analytics-service.md",
  },
  {
    question: "How long is event data retained before archival in the analytics service?",
    expectedSourceFile: "sample-analytics-service.md",
  },
  {
    question: "How many upload retries does the storage service attempt, and with what backoff?",
    expectedSourceFile: "sample-storage-service.md",
  },
  {
    question: "How many upload operations per minute is a storage account allowed?",
    expectedSourceFile: "sample-storage-service.md",
  },
  {
    question: "How quickly do clients pick up a feature flag change after it's edited in the admin console?",
    expectedSourceFile: "sample-config-service.md",
  },
  {
    question: "How long are config service audit log entries retained?",
    expectedSourceFile: "sample-config-service.md",
  },
];
