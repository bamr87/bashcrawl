// The fleet feedback widget as the app ships it: the vendored
// public/fleet-feedback.js evaluated into jsdom, <Feedback> mounted, a report
// filed. The kit's own contract tests own the issue format; this file proves
// that the copy we serve mounts, files against this repo and route with the
// marker the issue pipeline reads (UPS-FB-23), and that the report links on
// the not-found and crash screens open it pre-typed — or fall back to the
// issue form when it never loaded.
import { act, fireEvent, render, screen } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { NotFound } from "../screens/NotFound";
import { ErrorBoundary } from "./ErrorBoundary";
import { Feedback, FEEDBACK_FORM_URL } from "./Feedback";

const WIDGET = createRequire(import.meta.url).resolve("../../../public/fleet-feedback.js");

type FeedbackWindow = Window & { FleetFeedback?: { open: (options?: object) => void } };

function loadWidget(): void {
    if (customElements.get("fleet-feedback")) return;
    // A classic script, as index.html loads it; `module` is shadowed so its
    // CommonJS export branch stays off.
    const run = new Function("window", "globalThis", "module", readFileSync(WIDGET, "utf8"));
    run.call(window, window, window, undefined);
}

// Records whether a click reached the document with its default intact, then
// stops jsdom's navigation either way.
function clickDefaultKept(link: HTMLElement): boolean {
    let kept = false;
    const record = (event: Event) => {
        kept = !event.defaultPrevented;
        event.preventDefault();
    };
    document.addEventListener("click", record);
    fireEvent.click(link);
    document.removeEventListener("click", record);
    return kept;
}

function Boom(): never {
    throw new Error("the stairs gave way");
}

beforeAll(() => {
    // jsdom has <dialog> but not its modal API.
    const dialog = HTMLDialogElement.prototype as { showModal?: () => void; close?: () => void };
    if (typeof dialog.showModal !== "function") {
        dialog.showModal = function (this: HTMLDialogElement) {
            this.setAttribute("open", "");
        };
    }
    if (typeof dialog.close !== "function") {
        dialog.close = function (this: HTMLDialogElement) {
            this.removeAttribute("open");
            this.dispatchEvent(new Event("close"));
        };
    }
});

afterEach(() => {
    vi.restoreAllMocks();
    delete (window as FeedbackWindow).FleetFeedback;
});

describe("the feedback widget", () => {
    it("mounts once and files a structured issue against this repo and route", async () => {
        loadWidget();
        window.location.hash = "#/story";
        const { container } = render(<Feedback route="#/story" pageTitle="Bashcrawl — Story dungeon" />);

        const hosts = container.querySelectorAll("fleet-feedback");
        expect(hosts).toHaveLength(1);
        const host = hosts[0] as HTMLElement;
        expect(host).toHaveAttribute("repo", "bamr87/bashcrawl");
        expect(host).toHaveAttribute("branch", "main");
        expect(host).toHaveAttribute("route", "#/story");
        // The relative URL index.html already loads: never a second copy, never a root-absolute path.
        expect(document.querySelectorAll('script[src="./fleet-feedback.js"]')).toHaveLength(1);

        const shadow = host.shadowRoot as ShadowRoot;
        expect(shadow.querySelector("button.fab")).toHaveAttribute("aria-label", "Improve this page");

        const opened = vi.spyOn(window, "open").mockReturnValue({} as Window);
        await act(async () => { (window as FeedbackWindow).FleetFeedback?.open({ type: "fix-page" }); });
        const description = shadow.querySelector("#ff-desc") as HTMLTextAreaElement;
        fireEvent.input(description, { target: { value: "The chips cover the prompt." } });
        await act(async () => { fireEvent.submit(shadow.querySelector("form") as HTMLFormElement); });

        expect(opened).toHaveBeenCalledTimes(1);
        const url = new URL(String(opened.mock.calls[0]?.[0]));
        expect(`${url.origin}${url.pathname}`).toBe("https://github.com/bamr87/bashcrawl/issues/new");
        expect(url.searchParams.get("title")).toBe("[Report a problem] Bashcrawl — Story dungeon");
        expect(url.searchParams.get("labels")).toBe("page-feedback,bug");
        const body = url.searchParams.get("body") ?? "";
        expect(body).toContain("The chips cover the prompt.");
        expect(body).toContain("| **Collection/route** | #/story |");
        expect(body).toContain("<!-- fleet-feedback v1 type=fix-page -->");
    });

    it("the not-found screen reports the missing route through the widget", () => {
        const open = vi.fn();
        (window as FeedbackWindow).FleetFeedback = { open };
        render(<NotFound path="/nope" />);
        const link = screen.getByRole("link", { name: "Report the broken link" });
        expect(clickDefaultKept(link)).toBe(false);
        expect(open).toHaveBeenCalledWith({ type: "fix-page", extra: "Missing route: #/nope" });
    });

    it("a report link is the issue form when the widget never loaded", () => {
        render(<NotFound path="/nope" />);
        const link = screen.getByRole("link", { name: "Report the broken link" });
        expect(link).toHaveAttribute("href", FEEDBACK_FORM_URL);
        expect(link).toHaveAttribute("target", "_blank");
        expect(clickDefaultKept(link)).toBe(true);
    });

    it("the crash screen reports the error it caught", () => {
        vi.spyOn(console, "error").mockImplementation(() => {});
        const open = vi.fn();
        (window as FeedbackWindow).FleetFeedback = { open };
        render(<ErrorBoundary><Boom /></ErrorBoundary>);
        expect(screen.getByRole("heading", { name: "The dungeon collapsed" })).toBeInTheDocument();
        expect(clickDefaultKept(screen.getByRole("link", { name: "Report this" }))).toBe(false);
        expect(open).toHaveBeenCalledWith({ type: "fix-page", extra: "UI error: Error: the stairs gave way" });
    });
});
