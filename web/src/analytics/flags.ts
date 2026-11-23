// Feature flags, served by PostHog to visitors who allowed analytics. A flag
// is undefined until flags have loaded and for everyone who has not
// consented, so every call site must make sense with `undefined`: the
// default experience is always the one without the flag. Declare each flag
// here with the issue that will remove it (UPS-OPS-04: no flag outlives one
// release without a linked issue).
import { useSyncExternalStore } from "react";

import { featureFlag, subscribeFlags } from "./client";

export interface FlagSpec {
    /** What the flag changes for a visitor. */
    about: string;
    /** The issue that tracks removing it. */
    issue: string;
}

/** Every flag the code reads. Empty until the first experiment ships. */
export const FLAGS = {} as const satisfies Record<string, FlagSpec>;

export type FlagKey = keyof typeof FLAGS extends never ? string : keyof typeof FLAGS;

/** The flag's value: `true`/`false`, a variant name, or undefined when unknown. */
export function useFeatureFlag(key: FlagKey): boolean | string | undefined {
    return useSyncExternalStore(subscribeFlags, () => featureFlag(key), () => undefined);
}
