// Recover-in-place fallback (UPS-FE-16): the error, three ways out and a way
// to report it (the feedback widget lives outside this boundary, so it is
// still there, with the console lines that led up to the crash). A render
// error never blanks the page — the engine's own save is untouched.
import { Component, type ErrorInfo, type ReactNode } from "react";

import { captureError } from "../analytics/client";
import { ReportLink } from "./Feedback";

interface Props {
    children: ReactNode;
}

interface State {
    error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
    state: State = { error: null };

    static getDerivedStateFromError(error: Error): State {
        return { error };
    }

    componentDidCatch(error: Error, info: ErrorInfo): void {
        console.error("Bashcrawl UI error:", error, info.componentStack);
        captureError(error, { boundary: "app", component_stack: info.componentStack ?? "" });
    }

    render() {
        const { error } = this.state;
        if (!error) return this.props.children;
        return (
            <main id="main-content" className="bc-main" style={{ height: "100dvh" }}>
                <section className="bc-page bc-frame" aria-labelledby="bc-error-title">
                    <h1 id="bc-error-title" className="bc-display">The dungeon collapsed</h1>
                    <p>Something in the page broke. Your progress is saved in this browser and is not affected.</p>
                    <pre>{error.message}</pre>
                    <div className="bc-doors">
                        <button type="button" className="bc-btn bc-btn-primary" onClick={() => this.setState({ error: null })}>Try again</button>
                        <button type="button" className="bc-btn" onClick={() => window.location.reload()}>Reload</button>
                        <a className="bc-btn" href="#/story" onClick={() => this.setState({ error: null })}>Go to the entrance</a>
                        <ReportLink className="bc-btn" type="fix-page" extra={`UI error: ${error.name}: ${error.message}`}>Report this</ReportLink>
                    </div>
                </section>
            </main>
        );
    }
}
