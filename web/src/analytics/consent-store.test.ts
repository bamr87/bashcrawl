import { beforeEach, describe, expect, it } from "vitest";

import { analyticsAllowed, CONSENT_DAYS, CONSENT_KEY, getConsent, privacySignal, reloadConsent, setConsent, shouldAsk } from "./consent-store";

const DAY = 24 * 60 * 60 * 1000;

describe("consent store", () => {
    beforeEach(() => {
        window.localStorage.clear();
        reloadConsent();
    });

    it("starts unanswered: nothing is allowed and the question is due", () => {
        expect(getConsent().status).toBe("unset");
        expect(analyticsAllowed()).toBe(false);
        expect(shouldAsk(true)).toBe(true);
    });

    it("never asks in a build without analytics", () => {
        expect(shouldAsk(false)).toBe(false);
    });

    it("persists a yes and a no, and stops asking", () => {
        setConsent("granted");
        expect(analyticsAllowed()).toBe(true);
        expect(shouldAsk(true)).toBe(false);
        expect(JSON.parse(window.localStorage.getItem(CONSENT_KEY) ?? "{}")).toMatchObject({ analytics: "granted" });

        setConsent("denied");
        expect(analyticsAllowed()).toBe(false);
        expect(shouldAsk(true)).toBe(false);
        reloadConsent();
        expect(getConsent().status).toBe("denied");
    });

    it("asks again after 365 days", () => {
        const then = new Date("2026-01-01T00:00:00Z");
        setConsent("granted", then);
        reloadConsent(then.getTime() + (CONSENT_DAYS - 1) * DAY);
        expect(getConsent().status).toBe("granted");
        reloadConsent(then.getTime() + (CONSENT_DAYS + 1) * DAY);
        expect(getConsent().status).toBe("unset");
        expect(analyticsAllowed()).toBe(false);
    });

    it("ignores a corrupt or hand-edited answer", () => {
        window.localStorage.setItem(CONSENT_KEY, JSON.stringify({ analytics: "yes please", at: "never" }));
        reloadConsent();
        expect(getConsent().status).toBe("unset");
        window.localStorage.setItem(CONSENT_KEY, "{not json");
        reloadConsent();
        expect(getConsent().status).toBe("unset");
    });

    it("reads Global Privacy Control and Do Not Track as a no", () => {
        expect(privacySignal({ doNotTrack: null })).toBe(false);
        expect(privacySignal({ doNotTrack: "1" })).toBe(true);
        expect(privacySignal({ doNotTrack: null, globalPrivacyControl: true })).toBe(true);
    });
});
