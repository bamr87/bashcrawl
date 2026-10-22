'use client';
/**
 * FeedbackButton — React adapter for the universal <fleet-feedback> widget.
 * Spec: bamr87/bamr87 specs/FEEDBACK.md (UPS-FB-32). Kit: templates/feedback.
 *
 * Mount ONCE in the AppShell. `openFeedback()` lets the error boundary, the
 * 404 route, and "Suggest an edit" links open it pre-typed with context the
 * user should not have to retype:
 *
 *   <FeedbackButton repo="bamr87/aieo" branch="main" route={pathname} />
 *   openFeedback({ type: 'fix-page', extra: `Missing route: ${pathname}` })
 *   breadcrumb('net', `GET ${path} → ${res.status} (${ms}ms)`)   // from your fetch wrapper
 *
 * Works under React 18 and 19, Vite and Next (client components), because it
 * touches neither the removed global JSX namespace nor `import.meta.env`.
 *
 * Next.js: ALSO render <FeedbackCapture /> from adapters/nextjs.tsx in the root
 * layout. This component loads the widget after hydration, which is too late to
 * see the errors thrown during the initial load — capture has to come first.
 */
import { useEffect } from 'react';

/* React 19 removed the global JSX namespace; augmenting `react` itself is the
   form that compiles on both 18 and 19. */
declare module 'react' {
  namespace JSX {
    interface IntrinsicElements {
      'fleet-feedback': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> &
        Record<string, string | undefined>;
    }
  }
}

export interface OpenOptions {
  /** Taxonomy id — 'fix-page', 'improve-page', 'accessibility', … */
  type?: string;
  /** Pre-fills the textarea; the reader can still edit it. */
  description?: string;
  /** Appended to the description — an error stack, the route that 404'd. */
  extra?: string;
}

interface FleetFeedbackApi {
  open: (o?: OpenOptions) => void;
  close: () => void;
  breadcrumb: (level: string, message: string) => void;
  version: string;
}

function api(): FleetFeedbackApi | undefined {
  return typeof window === 'undefined'
    ? undefined
    : (window as unknown as { FleetFeedback?: FleetFeedbackApi }).FleetFeedback;
}

/** Open the dialog from anywhere — error boundary, 404 route, edit link. */
export function openFeedback(opts?: OpenOptions): void {
  api()?.open(opts);
}

/**
 * Record one line in the capture buffer. Call it from the app's fetch wrapper
 * on a failed request so a report carries the API call that actually broke:
 *   breadcrumb('net', `POST /api/analysis → 502 (1243ms) req=${requestId}`)
 */
export function breadcrumb(level: string, message: string): void {
  const w = window as unknown as { __fleetFeedback?: { breadcrumb?: (l: string, m: string) => void } };
  w.__fleetFeedback?.breadcrumb?.(level, message);
}

export interface FeedbackButtonProps {
  /** `owner/name` — required; without it the widget cannot file anywhere. */
  repo: string;
  branch?: string;
  /** Repo-relative source path of the current page, when the route maps to one. */
  source?: string;
  /** Route/pathname, for apps whose pages are not files. */
  route?: string;
  pageTitle?: string;
  /** Marker labels, comma-separated. Every one MUST exist in the repo. */
  labels?: string;
  /** '' disables assignment for agent-eligible types. */
  assignee?: string;
  mode?: 'url' | 'proxy' | 'postmessage';
  endpoint?: string;
  fab?: boolean;
  label?: string;
  /** Build environment — pass `process.env.NODE_ENV` or your own flag. */
  env?: string;
  appVersion?: string;
  /** Where the widget script is served from (vendor it; never hot-link the hub). */
  scriptSrc?: string;
  /** URL of a JSON array overriding the built-in taxonomy. */
  typesUrl?: string;
}

const DEFAULT_SRC = '/fleet-feedback.js';

export function FeedbackButton({
  repo,
  branch = 'main',
  source,
  route,
  pageTitle,
  labels = 'page-feedback',
  assignee = 'copilot',
  mode = 'url',
  endpoint,
  fab = true,
  label = 'Improve this page',
  env,
  appVersion,
  scriptSrc = DEFAULT_SRC,
  typesUrl,
}: FeedbackButtonProps) {
  useEffect(() => {
    if (document.querySelector(`script[src="${scriptSrc}"]`)) return;
    const s = document.createElement('script');
    s.src = scriptSrc;
    s.async = true;
    document.head.appendChild(s);
  }, [scriptSrc]);

  return (
    <fleet-feedback
      repo={repo}
      branch={branch}
      source={source}
      route={route}
      page-title={pageTitle}
      labels={labels}
      assignee={assignee}
      mode={mode}
      endpoint={endpoint}
      fab={fab ? 'true' : 'false'}
      label={label}
      env={env}
      app-version={appVersion}
      types={typesUrl}
    />
  );
}

export default FeedbackButton;
