// The fleet feedback widget, bashcrawl's half (UPS-FB-01/07/09/32, bamr87/bamr87
// specs/FEEDBACK.md): where reports go, the one mount, and the report links the
// not-found screen and the crash screen offer. The widget itself is the fleet
// kit's, vendored and never edited here: public/fleet-feedback.js (plus the
// capture buffer index.html loads before the engine) and its React adapter,
// components/FeedbackButton.tsx.
import type { MouseEvent, ReactNode } from "react";

import { FeedbackButton, openFeedback, type OpenOptions } from "../../../components/FeedbackButton";

export const FEEDBACK_REPO = "bamr87/bashcrawl";

// The widget's no-JS twin (.github/ISSUE_TEMPLATE/page_feedback.yml): where a
// report link goes when the widget never loaded.
export const FEEDBACK_FORM_URL = `https://github.com/${FEEDBACK_REPO}/issues/new?template=page_feedback.yml&labels=page-feedback`;

export interface FeedbackProps {
    /** The hash route the reader is on (#/story, #/nope…). */
    route?: string;
    /** Names the door in the issue title; the document title otherwise. */
    pageTitle?: string;
}

/** The floating "Improve this page" button and its dialog. Mount it once. */
export function Feedback({ route, pageTitle }: FeedbackProps) {
    return (
        <FeedbackButton
            repo={FEEDBACK_REPO}
            branch="main"
            route={route}
            pageTitle={pageTitle}
            env={import.meta.env.MODE}
            scriptSrc="./fleet-feedback.js"
        />
    );
}

function widgetLoaded(): boolean {
    return typeof window !== "undefined" && "FleetFeedback" in window;
}

export interface ReportLinkProps extends OpenOptions {
    className?: string;
    children: ReactNode;
}

/** A real link to the issue form that opens the widget, pre-typed, once it has loaded. */
export function ReportLink({ className, children, ...preset }: ReportLinkProps) {
    const onClick = (event: MouseEvent<HTMLAnchorElement>) => {
        if (!widgetLoaded()) return;
        event.preventDefault();
        openFeedback(preset);
    };
    return (
        <a className={className} href={FEEDBACK_FORM_URL} target="_blank" rel="noopener noreferrer" onClick={onClick}>
            {children}
        </a>
    );
}
