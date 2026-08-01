"use strict";
// Per-command tables for the posix + flavour packs on a small fixture world,
// exercised through a bare framework Shell (no game). The bashcrawl goldens
// cover these same functions through the full game; this file covers them as
// standalone framework parts, including flags the game transcripts don't hit.

const test = require("node:test");
const assert = require("node:assert");
const { Shell } = require("../core/shell.js");
const posix = require("../core/packs/posix.js");
const flavour = require("../core/packs/flavour.js");

function makeShell() {
    return new Shell({
        world: {
            root: "/w",
            directories: {
                "/w": [
                    { name: "fruits", type: "file", hidden: false },
                    { name: "csv", type: "file", hidden: false },
                    { name: "nest", type: "dir", hidden: false },
                    { name: ".hid", type: "file", hidden: true },
                ],
                "/w/nest": [{ name: "deep", type: "file", hidden: false }],
            },
            files: {
                "/w/fruits": "banana\napple\ncherry\napple",
                "/w/csv": "a,b,c\nd,e,f",
                "/w/nest/deep": "needle here",
                "/w/.hid": "shy",
            },
        },
        packs: [posix, flavour],
        rng: () => 0.999,
    });
}

function run(shell, line) {
    const out = shell.execute(line);
    return out.map((o) => o.text ?? `<${o.action}>`).join("\n");
}

test("navigation and listing", () => {
    const s = makeShell();
    assert.strictEqual(run(s, "pwd"), "/w");
    assert.strictEqual(run(s, "ls"), "csv  fruits  nest");
    assert.strictEqual(run(s, "ls -a"), ".hid  csv  fruits  nest");
    assert.strictEqual(run(s, "ls -F"), "csv  fruits  nest/");
    assert.strictEqual(run(s, "cd nest"), "Moved to /w/nest");
    assert.strictEqual(run(s, "cd -"), "/w\nMoved to /w");
    assert.strictEqual(s.execute("cd bogus")[0].kind, "error");
    assert.match(run(s, "tree"), /├── csv[\s\S]*└── nest\/[\s\S]*deep/);
});

test("readers: cat/head/tail/wc/nl/rev", () => {
    const s = makeShell();
    assert.strictEqual(run(s, "cat fruits"), "banana\napple\ncherry\napple");
    assert.strictEqual(run(s, "head -2 fruits"), "banana\napple");
    assert.strictEqual(run(s, "head -n 1 fruits"), "banana");
    assert.strictEqual(run(s, "tail -1 fruits"), "apple");
    assert.strictEqual(run(s, "wc fruits"), "4 4 25 fruits");
    assert.strictEqual(run(s, "cat fruits | wc -l"), "4 4 25");
    assert.strictEqual(run(s, "cat fruits | nl").split("\n")[0], "     1  banana");
    assert.strictEqual(run(s, "echo abc | rev"), "cba");
});

test("grep flag matrix", () => {
    const s = makeShell();
    assert.strictEqual(run(s, "grep apple fruits"), "apple\napple");
    assert.strictEqual(run(s, "grep -c apple fruits"), "2");
    assert.strictEqual(run(s, "grep -n cherry fruits"), "3:cherry");
    assert.strictEqual(run(s, "grep -v apple fruits"), "banana\ncherry");
    assert.strictEqual(run(s, "grep -i APPLE fruits"), "apple\napple");
    assert.strictEqual(run(s, "grep -r needle ."), "./nest/deep:needle here");
    assert.strictEqual(run(s, "grep -rl needle ."), "./nest/deep");
    assert.strictEqual(run(s, "grep -r shy ."), "./.hid:shy", "grep -r searches dotfiles");
    assert.strictEqual(run(s, "cat fruits | grep -w an"), "(no matches for 'an')");
    assert.strictEqual(run(s, "cat fruits | grep banana -"), "banana",
        "lone dash reads the pipe");
});

test("transformers: sort/uniq/cut/tr/sed", () => {
    const s = makeShell();
    assert.strictEqual(run(s, "sort fruits"), "apple\napple\nbanana\ncherry");
    assert.strictEqual(run(s, "sort -r fruits").split("\n")[0], "cherry");
    assert.strictEqual(run(s, "sort -u fruits"), "apple\nbanana\ncherry");
    assert.strictEqual(run(s, "sort fruits | uniq -c").trim().split("\n")[0].trim(), "2 apple");
    assert.strictEqual(run(s, "sort fruits | uniq -d"), "apple");
    assert.strictEqual(run(s, "cut -d, -f2 csv"), "b\ne");
    assert.strictEqual(run(s, "cut -c1-3 csv"), "a,b\nd,e");
    assert.strictEqual(run(s, "cat csv | tr a-f A-F"), "A,B,C\nD,E,F");
    assert.strictEqual(run(s, "cat csv | tr -d ,"), "abc\ndef");
    assert.strictEqual(run(s, "sed 's/apple/mango/' fruits"), "banana\nmango\ncherry\nmango");
    assert.strictEqual(run(s, "cat fruits | sed 's/A/X/i'"), "bXnana\nXpple\ncherry\nXpple");
});

test("finders and metadata", () => {
    const s = makeShell();
    assert.strictEqual(run(s, "find . -name deep"), "./nest/deep");
    assert.strictEqual(run(s, "find . -type d"), "./nest");
    assert.strictEqual(run(s, "find . -name '*.zzz'"), "(nothing found)");
    assert.strictEqual(run(s, "file nest"), "nest: directory");
    assert.strictEqual(run(s, "file fruits"), "fruits: text file");
    assert.match(run(s, "man ls"), /NAME\n    ls/);
    assert.match(run(s, "man ls"), /Built-in command/, "framework man note, not the game's");
    assert.strictEqual(s.execute("man nothere")[0].kind, "error");
});

test("mutators: mkdir/touch/cp/mv/rm/chmod respect the overlay rules", () => {
    const s = makeShell();
    assert.strictEqual(run(s, "mkdir camp"), "Created directory camp");
    assert.strictEqual(s.execute("mkdir camp")[0].kind, "error");
    assert.strictEqual(run(s, "touch camp/tent"), "Touched camp/tent");
    assert.strictEqual(run(s, "cp fruits camp/fruits2"), "Copied fruits to camp/fruits2");
    assert.strictEqual(run(s, "mv camp/fruits2 camp/basket"), "Moved camp/fruits2 to camp/basket");
    assert.strictEqual(s.execute("mv fruits nope")[0].kind, "error", "world files don't move");
    assert.strictEqual(run(s, "rm camp/basket"), "Removed camp/basket");
    assert.strictEqual(s.execute("rm fruits")[0].kind, "error", "world files are indestructible");
    assert.strictEqual(run(s, "chmod +x camp/tent"), "Marked camp/tent as executable.");
    assert.strictEqual(run(s, "ls -F camp"), "tent*");
    assert.strictEqual(run(s, "chmod -x camp/tent"), "Removed executable bit from camp/tent.");
    assert.strictEqual(s.execute("chmod +x fruits")[0].kind, "error");
});

test("variables and quoting", () => {
    const s = makeShell();
    assert.strictEqual(run(s, "export NAME=world"), "Exported NAME=world");
    assert.strictEqual(run(s, "echo hello $NAME"), "hello world");
    assert.strictEqual(run(s, "export GREET=hi-$NAME"), "Exported GREET=hi-world");
    assert.strictEqual(run(s, "let N=N+3"), "N=3");
    assert.strictEqual(run(s, "let N=N-1"), "N=2");
    assert.strictEqual(s.execute("let N=N*2")[0].kind, "error");
    assert.strictEqual(run(s, "env"), "NAME=world\nGREET=hi-world\nN=2");
});

test("flavour pack renders its art deterministically", () => {
    const s = makeShell();
    assert.match(run(s, "fortune"), /scripts be sourced/, "rng()=0.999 draws the last fortune");
    assert.match(run(s, "cowsay ahoy"), /< ahoy >/);
    assert.match(run(s, "echo piped | cowsay"), /< piped >/);
    assert.strictEqual(run(s, "figlet ab"), "A B\n====");
    assert.match(run(s, "banner"), /Type {2}pwd {2}to begin/);
    assert.match(run(s, "sl"), /typos take you for a ride/);
    assert.deepStrictEqual(s.execute("clear"), [{ kind: "control", action: "clear" }]);
});

test("history renders from state (hosts own the pushes)", () => {
    const s = makeShell();
    assert.strictEqual(run(s, "history"), "(empty)");
    s.state.history.push("pwd", "ls -a");
    assert.strictEqual(run(s, "history"), "1  pwd\n2  ls -a");
});
