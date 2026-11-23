// The one question (UPS-FE-24): asked once, at the bottom of the page, never
// in the way of playing. Yes and no are the same size and one click each;
// "What is collected" opens the full list. Not rendered at all in a build
// without analytics, once answered, or when the browser already said no.
import { setUi } from "../chrome/ui-store";
import { analyticsConfig } from "./config";
import { setConsent, shouldAsk, useConsent } from "./consent-store";

export function ConsentBanner() {
    // Subscribed for the re-render when the answer lands.
    useConsent();
    if (!shouldAsk(analyticsConfig() !== null)) return null;
    return (
        <aside className="bc-consent" role="region" aria-labelledby="bc-consent-title">
            <div className="bc-consent-text">
                <h2 id="bc-consent-title" className="bc-consent-title">Help improve Bashcrawl?</h2>
                <p>
                    With your OK, this site records anonymous usage: which lessons get finished, where people get stuck, errors, and a replay of your visit here.
                    No cookies, no ads, no account, and nothing is sent unless you say yes.
                </p>
            </div>
            <div className="bc-consent-actions">
                <button type="button" className="bc-btn" onClick={() => setConsent("granted")}>Allow analytics</button>
                <button type="button" className="bc-btn" onClick={() => setConsent("denied")}>No thanks</button>
                <button type="button" className="bc-link" onClick={() => setUi({ privacyOpen: true })}>What is collected</button>
            </div>
        </aside>
    );
}
