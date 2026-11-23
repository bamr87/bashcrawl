// What this build is and whether it may measure anything: read once from
// the browser-exposed build variables (UPS-OPS-01/02). Analytics exists only
// in a build that was given a PostHog project key, which the deploy passes
// to the production site alone, so a local build, a preview and the GitHub
// Pages copy collect nothing (UPS-FE-24's production-only gate). None of
// these values is a secret: a PostHog project key is public by design.
export type AppEnv = "production" | "staging" | "preview" | "development" | "test";

export interface AnalyticsConfig {
    /** The PostHog project key (`phc_…`). */
    key: string;
    /** Where events are sent: PostHog Cloud, or a reverse proxy in front of it. */
    host: string;
    /** The PostHog app itself, when `host` is a proxy. */
    uiHost: string | null;
}

export interface BuildInfo {
    version: string;
    commit: string;
    env: AppEnv;
}

const DEFAULT_HOST = "https://us.i.posthog.com";
const ENVS: readonly AppEnv[] = ["production", "staging", "preview", "development", "test"];

function text(value: unknown): string {
    return typeof value === "string" ? value.trim() : "";
}

function httpsUrl(value: string): string | null {
    try {
        const url = new URL(value);
        return url.protocol === "https:" ? url.origin + url.pathname.replace(/\/+$/, "") : null;
    } catch {
        return null;
    }
}

/** Parse the build variables; null when the build carries no usable key. */
export function parseConfig(env: Record<string, unknown>): AnalyticsConfig | null {
    const key = text(env.VITE_POSTHOG_KEY);
    if (!key) return null;
    const host = httpsUrl(text(env.VITE_POSTHOG_HOST) || DEFAULT_HOST);
    if (!host) return null;
    const uiHost = text(env.VITE_POSTHOG_UI_HOST);
    return { key, host, uiHost: uiHost ? httpsUrl(uiHost) : null };
}

export function parseBuild(env: Record<string, unknown>, version: string, commit: string): BuildInfo {
    const named = text(env.VITE_APP_ENV) as AppEnv;
    const mode = text(env.MODE);
    const fallback: AppEnv = mode === "test" ? "test" : mode === "production" ? "production" : "development";
    return { version, commit, env: ENVS.includes(named) ? named : fallback };
}

let override: AnalyticsConfig | null | undefined;

/** The build's analytics configuration, or null: this build measures nothing. */
export function analyticsConfig(): AnalyticsConfig | null {
    if (override !== undefined) return override;
    return parseConfig(import.meta.env);
}

/** Tests only: stand in for the build variables (`undefined` restores them). */
export function setAnalyticsConfigForTest(config: AnalyticsConfig | null | undefined): void {
    override = config;
}

export function buildInfo(): BuildInfo {
    return parseBuild(import.meta.env, __BC_VERSION__, __BC_COMMIT__);
}
