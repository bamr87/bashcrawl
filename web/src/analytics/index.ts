// Usage analytics (PostHog), consent first. See docs/analytics.md.
export { captureError, track } from "./client";
export { analyticsConfig } from "./config";
export { analyticsAllowed, getConsent, privacySignal, setConsent, shouldAsk, useConsent, type ConsentChoice, type ConsentStatus } from "./consent-store";
export { installAnalytics, surfaceOf } from "./install";
export { useFeatureFlag } from "./flags";
