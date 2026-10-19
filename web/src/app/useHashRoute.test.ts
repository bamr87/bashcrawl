import { describe, expect, it } from "vitest";

import { currentRoute, hrefFor, navigate, parseHash } from "./useHashRoute";

describe("hash routing", () => {
    it("parses the four doors, an empty hash and anything else", () => {
        expect(parseHash("#/story")).toEqual({ kind: "mode", mode: "story" });
        expect(parseHash("#/learn")).toEqual({ kind: "mode", mode: "learn" });
        expect(parseHash("#/arcade?x=1")).toEqual({ kind: "mode", mode: "arcade" });
        expect(parseHash("#/reference/")).toEqual({ kind: "mode", mode: "reference" });
        expect(parseHash("")).toEqual({ kind: "none" });
        expect(parseHash("#")).toEqual({ kind: "none" });
        expect(parseHash("#/")).toEqual({ kind: "none" });
        expect(parseHash("#/nope")).toEqual({ kind: "notfound", path: "/nope" });
        expect(parseHash("#story")).toEqual({ kind: "mode", mode: "story" });
    });

    it("builds hrefs and navigates by replacing the hash", () => {
        expect(hrefFor("learn")).toBe("#/learn");
        navigate("arcade");
        expect(window.location.hash).toBe("#/arcade");
        expect(currentRoute()).toEqual({ kind: "mode", mode: "arcade" });
        window.location.hash = "#/reference";
        window.dispatchEvent(new HashChangeEvent("hashchange"));
        expect(currentRoute()).toEqual({ kind: "mode", mode: "reference" });
    });
});
