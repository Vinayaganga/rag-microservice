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
];
