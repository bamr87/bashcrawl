/// <reference types="vite/client" />

// Build identity, injected by vite.config.mts (`define`).
declare const __BC_VERSION__: string;
declare const __BC_COMMIT__: string;

// The browser-exposed build variables (.env.example). None is a secret.
interface ImportMetaEnv {
    /** The site's canonical origin, e.g. https://example.com (no trailing slash). */
    readonly VITE_SITE_URL?: string;
    /** PostHog project key; analytics exists only in a build that has one. */
    readonly VITE_POSTHOG_KEY?: string;
    /** PostHog ingestion host, or a reverse proxy in front of it. */
    readonly VITE_POSTHOG_HOST?: string;
    /** The PostHog app, when VITE_POSTHOG_HOST is a proxy. */
    readonly VITE_POSTHOG_UI_HOST?: string;
    /** production | staging | preview. */
    readonly VITE_APP_ENV?: string;
}
