// Privacy, in full and in the app: whether anything is measured, the switch,
// and the complete list of what is sent, rendered from the same catalogue
// `track()` is typed against (events.ts), so the list cannot fall behind the
// code. Reached from the consent banner, Options and the home page footer.
import { Dialog } from "../chrome/Dialog";
import { setUi, useUi } from "../chrome/ui-store";
import { analyticsConfig } from "./config";
import { privacySignal, setConsent, useConsent } from "./consent-store";
import { AUTOMATIC_DATA, COMMON_PROPERTIES, EVENT_CATALOG, EVENT_NAMES, NEVER_COLLECTED, type EventName, type EventSpec } from "./events";

export const ANALYTICS_DOC_URL = "https://github.com/bamr87/bashcrawl/blob/main/docs/analytics.md";

const close = () => setUi({ privacyOpen: false });

export function PrivacyDialog() {
    const { privacyOpen } = useUi();
    const consent = useConsent();
    const configured = analyticsConfig() !== null;
    const on = consent.status === "granted";

    return (
        <Dialog open={privacyOpen} title="Privacy" onClose={close} className="bc-privacy">
            <div className="bc-privacy-body">
                <p>
                    Bashcrawl is free and open source. Your game is saved in this browser only. There is no account, no advertising and no cookie.
                </p>

                {configured ? (
                    <section className="bc-privacy-switch" aria-labelledby="bc-privacy-analytics">
                        <div>
                            <h3 id="bc-privacy-analytics">Usage analytics</h3>
                            <p>
                                {on
                                    ? "On. Thank you: this is how the lessons get better."
                                    : consent.status === "denied"
                                        ? "Off. Nothing is sent."
                                        : privacySignal()
                                            ? "Off. Your browser asks sites not to track you, so this site did not ask."
                                            : "Off until you choose. Nothing is sent."}
                            </p>
                        </div>
                        <button type="button" role="switch" aria-checked={on} aria-labelledby="bc-privacy-analytics" className="bc-switch" onClick={() => setConsent(on ? "denied" : "granted")}>
                            <span className="bc-visually-hidden">{on ? "On" : "Off"}</span>
                        </button>
                    </section>
                ) : (
                    <p className="bc-privacy-note">This copy of Bashcrawl has analytics switched off entirely: it sends nothing, and there is nothing to opt out of.</p>
                )}

                <h3>Never collected</h3>
                <ul>
                    {NEVER_COLLECTED.map((line) => <li key={line}>{line}</li>)}
                </ul>

                <h3>Collected only if you allow analytics</h3>
                <p>
                    Events go to <a href="https://posthog.com" target="_blank" rel="noopener noreferrer">PostHog</a>, the analytics service this project uses. Switching analytics off stops them and deletes PostHog’s data from this browser.
                </p>
                <ul>
                    {AUTOMATIC_DATA.map((line) => <li key={line}>{line}</li>)}
                </ul>

                <h3>Every product event</h3>
                <p>
                    Each also carries {Object.entries(COMMON_PROPERTIES).map(([key, about]) => `${key} (${about})`).join(", ")}.
                </p>
                <dl className="bc-privacy-events">
                    {EVENT_NAMES.map((name) => {
                        const spec = EVENT_CATALOG[name] as EventSpec<EventName>;
                        return (
                            <div key={name}>
                                <dt><code>{name}</code> <span>{spec.about}</span></dt>
                                <dd>
                                    {Object.entries(spec.props as Record<string, string>).map(([prop, about]) => (
                                        <span key={prop}><code>{prop}</code> {about}</span>
                                    ))}
                                </dd>
                            </div>
                        );
                    })}
                </dl>

                <p>
                    The same list, with how to audit it, is in <a href={ANALYTICS_DOC_URL} target="_blank" rel="noopener noreferrer">docs/analytics.md</a>.
                </p>
            </div>
        </Dialog>
    );
}
