import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { getUi, setUi } from "../chrome/ui-store";
import { setAnalyticsConfigForTest } from "./config";
import { ConsentBanner } from "./ConsentBanner";
import { getConsent, reloadConsent } from "./consent-store";

function setGpc(value: boolean | undefined) {
    Object.defineProperty(navigator, "globalPrivacyControl", { value, configurable: true });
}

describe("consent banner", () => {
    beforeEach(() => {
        window.localStorage.clear();
        reloadConsent();
        setUi({ privacyOpen: false });
        setAnalyticsConfigForTest({ key: "phc_test", host: "https://us.i.posthog.com", uiHost: null });
    });

    afterEach(() => {
        setAnalyticsConfigForTest(undefined);
        setGpc(undefined);
    });

    it("is absent from a build without analytics", () => {
        setAnalyticsConfigForTest(null);
        render(<ConsentBanner />);
        expect(screen.queryByRole("region", { name: /help improve bashcrawl/i })).toBeNull();
    });

    it("asks once, with yes and no one click each", () => {
        render(<ConsentBanner />);
        expect(screen.getByRole("region", { name: /help improve bashcrawl/i })).toBeInTheDocument();
        fireEvent.click(screen.getByRole("button", { name: "No thanks" }));
        expect(getConsent().status).toBe("denied");
        expect(screen.queryByRole("region", { name: /help improve bashcrawl/i })).toBeNull();
    });

    it("records a yes", () => {
        render(<ConsentBanner />);
        fireEvent.click(screen.getByRole("button", { name: "Allow analytics" }));
        expect(getConsent().status).toBe("granted");
        expect(screen.queryByRole("region")).toBeNull();
    });

    it("opens the full list without answering", () => {
        render(<ConsentBanner />);
        fireEvent.click(screen.getByRole("button", { name: "What is collected" }));
        expect(getUi().privacyOpen).toBe(true);
        expect(getConsent().status).toBe("unset");
    });

    it("does not ask a browser that sends Global Privacy Control", () => {
        setGpc(true);
        render(<ConsentBanner />);
        expect(screen.queryByRole("region")).toBeNull();
        expect(getConsent().status).toBe("unset");
    });
});
