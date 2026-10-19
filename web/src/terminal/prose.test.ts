import { describe, expect, it } from "vitest";

import { readGameData } from "../test/engine";
import { commandOf, inlineLight, isFileView, ProseDecorator, renderProseHtml, SHELL_WORDS, type ProseContext } from "./prose";

const escapeHtml = (value: unknown) =>
    String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
const ctx: ProseContext = {
    commands: new Set(["ls", "cd", "cat", "pwd", "mkdir", "touch", "grep", "echo", "head", "tail", "wc", "less", "find", "tree", "map", ...SHELL_WORDS]),
    escapeHtml,
};
const line = (text: string) => new ProseDecorator(ctx).line(text);
const textOf = (html: string) => {
    const el = document.createElement("span");
    el.innerHTML = html;
    return el.textContent;
};

describe("prose classifier", () => {
    it("recognises the scroll's structure", () => {
        expect(line("=".repeat(80)).cls).toBe("rule");
        expect(line("-".repeat(80)).cls).toBe("rule-soft");
        expect(line("~".repeat(40)).cls).toBe("rule-soft");
        const titled = new ProseDecorator(ctx);
        titled.line("=".repeat(80));
        expect(titled.line("                           ANCIENT SCROLL OF SIGHT").cls).toBe("h1");
        expect(line("#                🌟 THE CELLAR OF TRUE SIGHT - ENHANCED TERMINAL VISION       #").cls).toBe("h1");
        expect(line("🔮 ANCIENT WISDOM: Seeing Beyond the Veil").cls).toBe("h2");
        expect(line("                   COMMAND CHAINING: Pipes & Logic").cls).toBe("h2");
        expect(line("NEXT DESTINATION:").cls).toBe("labelled");
        expect(line("LOST? Remember these two spells:").html).toContain('<span class="sc-label">LOST?</span>');
        expect(line("Try it now:").cls).toBe("labelled");
        expect(line("MASTERY REQUIREMENTS").cls).toBe("label");
        expect(line("COMMAND            PURPOSE                      DESCRIPTION").cls).toBe("th");
        expect(line("--------           --------                     -----------").cls).toBe("rule-soft");
        expect(line("✅ Complete basic command execution").html).toContain('<span class="sc-ok">✅</span>');
        expect(line("It is pitch black in these catacombs.").cls).toBe("text");
    });

    it("highlights commands and makes them castable", () => {
        const prompt = line("    $ ls -F                  # Cast enhanced sight spell");
        expect(prompt.cls).toBe("cmd");
        expect(prompt.html).toContain('data-fill="ls -F"');
        expect(prompt.html).toContain('<span class="sc-cmd-name">ls</span>');
        expect(prompt.html).toContain('<span class="sc-flag">-F</span>');
        expect(prompt.html).toContain("sc-comment");
        expect(textOf(prompt.html)).toBe("    $ ls -F                  # Cast enhanced sight spell");

        const row = line("cat filename       View scrolls fully           Display entire scroll content");
        expect(row.cls).toBe("cmd");
        expect(row.html).toContain('data-fill="cat filename"');
        expect(row.html).toContain("sc-desc");

        expect(line("    mkdir workshop           # Conjure a new room from the void").html).toContain('data-fill="mkdir workshop"');
        expect(line("    cd courtyard    Explore the chapel grounds").html).toContain('data-fill="cd courtyard"');
        expect(line("    cmd1 | cmd2                      Pipe: output of cmd1 feeds into cmd2").html).toContain('<span class="sc-op">|</span>');
        expect(line('    echo "Inventory: $I" && echo "Health: $HP"').html).toContain('<span class="sc-str">&quot;Inventory: $I&quot;</span>');
        expect(line("    courtyard/     An open area with a fountain and strange rags").html).toContain('<span class="sc-dir">courtyard/</span>');

        // Prose that happens to start with a command word stays prose.
        expect(line("Try looking around this room, then move into one of the next rooms.").cls).toBe("text");
        expect(line("less is more in this room.").cls).toBe("text");
        expect(line("    find the key before you leave").cls).toBe("text");
        expect(line("cd is the spell for moving").cls).toBe("text");
    });

    it("renders emphasis, code and variables without rewriting the text", () => {
        const raw = "**Illusions are strong here.** Type `ls -F` and read *carefully*; check $I.";
        const r = line(raw);
        expect(r.html).toContain('<strong class="sc-strong">Illusions are strong here.</strong>');
        expect(r.html).toContain('<span class="sc-code" data-fill="ls -F" title="Click to type this">ls -F</span>');
        expect(r.html).toContain('<em class="sc-em">carefully</em>');
        expect(r.html).toContain('<span class="sc-var">$I</span>');
        expect(textOf(r.html)).toBe(raw);
        expect(line("*The air grows thick with mystical energy...*").cls).toBe("em");
        expect(line("# 🚪 Welcome to the Entrance").cls).toBe("md-h1");
        expect(line("### Navigation Magic").cls).toBe("md-h3");
        expect(line("- `ls` - Reveals all items in your current location").cls).toBe("bullet");
        expect(line("    1. FIRST STEP: Cast the enhanced spell manually").html).toContain('<span class="sc-label">FIRST STEP:</span>');
        // `code` that is not a command is a chip you cannot cast.
        expect(line("the `$I` variable").html).toContain('<span class="sc-code">$I</span>');
        // Bold wrapping code (the READMEs do this) still hides its markers.
        const nested = line("*   **`/` at the end means a Directory** (a room you can enter).");
        expect(nested.cls).toBe("bullet");
        expect(nested.html).toContain('<strong class="sc-strong"><span class="sc-mark">`</span><span class="sc-code">/</span><span class="sc-mark">`</span> at the end means a Directory</strong>');
        expect(textOf(nested.html)).toBe("*   **`/` at the end means a Directory** (a room you can enter).");
    });

    it("keeps box tables aligned and classifies what is inside them", () => {
        const d = new ProseDecorator(ctx);
        const top = d.line("┌─ ENHANCED SIGHT INCANTATION ───────────────────────────────────────────────┐");
        expect(top.cls).toBe("box");
        expect(top.html).toContain('<span class="sc-box-title"> ENHANCED SIGHT INCANTATION </span>');
        expect(top.html).toContain('<span class="sc-frame">┌─</span>');
        const inner = d.line("│ $ ls -F                           # Cast enhanced sight spell              │");
        expect(inner.html).toContain('data-fill="ls -F"');
        expect(textOf(inner.html)).toBe("│ $ ls -F                           # Cast enhanced sight spell              │");
        expect(d.line("│ Expected Manifestation:                                                     │").html).toContain("sc-label");
        expect(d.line("└─────────────────────────────────────────────────────────────────────────────┘").cls).toBe("box");
    });

    it("escapes the file's own markup", () => {
        const r = line("Beware <script>alert(1)</script> & co");
        expect(r.html).not.toContain("<script>");
        expect(r.html).toContain("&lt;script&gt;");
        expect(textOf(r.html)).toBe("Beware <script>alert(1)</script> & co");
    });

    it("treats a shell script as code and its heredoc as story", () => {
        const d = new ProseDecorator(ctx);
        expect(d.line("#!/usr/bin/env bash").cls).toBe("comment");
        expect(d.line("# If you are reading this, you have wandered").cls).toBe("comment");
        expect(d.line("export I=amulet,$I").cls).toBe("cmd");
        expect(d.line("cat << EOF").cls).toBe("cmd");
        expect(d.line("You find a chest. # not a comment").cls).toBe("text");
        expect(d.line("EOF").cls).toBe("heredoc");
        expect(d.line('if grep --quiet amulet <<< "$I"; then').html).toContain('<span class="sc-kw">if</span>');
    });

    it("round-trips every real scroll byte for byte", () => {
        const { world } = readGameData();
        const files = Object.entries(world.files).filter(([path]) => path.endsWith("/scroll") || path.endsWith("README.md"));
        expect(files.length).toBeGreaterThan(20);
        for (const [, text] of files) {
            const d = new ProseDecorator(ctx);
            for (const raw of text.split("\n")) expect(textOf(d.line(raw).html)).toBe(raw);
        }
        const entrance = renderProseHtml(world.files["/entrance/scroll"] ?? "", ctx);
        expect(entrance).toContain('class="sc sc-h1"');
        expect((entrance.match(/data-fill=/g) ?? []).length).toBeGreaterThan(10);
        expect(textOf(entrance)).toBe(world.files["/entrance/scroll"]);
    });

    it("lights up code in the runtime's own messages", () => {
        expect(inlineLight("Try `ls -la` and read the scrolls.", ctx)).toContain('data-fill="ls -la"');
        expect(inlineLight("Type 'map' for the dungeon map", ctx)).toContain('<span class="sc-code" data-fill="map"');
        expect(inlineLight("Type 'please' nicely", ctx)).toBeNull();
        expect(inlineLight("plain text", ctx)).toBeNull();
        expect(commandOf("  cat scroll | grep rift")).toBe("cat");
        expect(isFileView("less scroll")).toBe(true);
        expect(isFileView("ls -la")).toBe(false);
    });
});
