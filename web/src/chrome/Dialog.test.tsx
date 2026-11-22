import { act, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { Dialog } from "./Dialog";

describe("dialogs", () => {
    it("give Escape to the one on top only", async () => {
        const closeOptions = vi.fn();
        const closePrivacy = vi.fn();
        function Pair({ privacy }: { privacy: boolean }) {
            return (
                <>
                    <Dialog open title="Options" onClose={closeOptions}>options</Dialog>
                    <Dialog open={privacy} title="Privacy" onClose={closePrivacy}>privacy</Dialog>
                </>
            );
        }
        const { rerender } = render(<Pair privacy />);
        expect(screen.getByRole("dialog", { name: "Privacy" })).toBeInTheDocument();

        await act(async () => { document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true })); });
        expect(closePrivacy).toHaveBeenCalledTimes(1);
        expect(closeOptions).not.toHaveBeenCalled();

        // With Privacy gone, the next Escape is Options' own.
        rerender(<Pair privacy={false} />);
        await act(async () => { document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true })); });
        expect(closeOptions).toHaveBeenCalledTimes(1);
        expect(closePrivacy).toHaveBeenCalledTimes(1);
    });
});
