"use strict";
// web/assets/js/vim.js — the modal editor behind the Vim Catacombs trial.
// The contract a vim user would notice: word classes, `dw` staying on its
// line, `cw` acting like `ce`, `$` remembering the column, `t` stopping one
// short, `;`/`,`, wrap-around search, Escape stepping back, one undo per
// insert, and the spellbook (allowed-key) gate.

const test = require("node:test");
const assert = require("node:assert/strict");

const Vim = require("../../web/assets/js/vim.js");

function play(state, keys, allowed) {
    const results = [];
    for (const key of Vim.toKeys(keys)) results.push(Vim.feed(state, key, { allowed }));
    return results;
}

function at(state) {
    return [state.row, state.col];
}

test("toKeys reads vim's own notation", () => {
    assert.deepEqual(Vim.toKeys("3w"), ["3", "w"]);
    assert.deepEqual(Vim.toKeys("A now<esc>"), ["A", " ", "n", "o", "w", "Escape"]);
    assert.deepEqual(Vim.toKeys("o<CR><BS><lt><space>"), ["o", "Enter", "Backspace", "<", " "]);
    assert.deepEqual(Vim.toKeys("x\x1b\n"), ["x", "Escape", "Enter"]);
});

test("h j k l stay inside the buffer and $ remembers the column", () => {
    const state = Vim.createState(["abcdef", "ab", "abcdefgh"]);
    play(state, "lll");
    assert.deepEqual(at(state), [0, 3]);
    play(state, "j");
    assert.deepEqual(at(state), [1, 1], "j clamps to the short line");
    play(state, "j");
    assert.deepEqual(at(state), [2, 3], "the wanted column survives a short line");
    play(state, "$k");
    assert.deepEqual(at(state), [1, 1]);
    play(state, "k");
    assert.deepEqual(at(state), [0, 5], "$ sticks to line ends");
    const edge = play(state, "k")[0];
    assert.equal(edge.applied, false);
    assert.equal(edge.error.code, "fail");
    play(state, "hhhhhhhhh");
    assert.deepEqual(at(state), [0, 0]);
    play(state, "10l");
    assert.deepEqual(at(state), [0, 5], "a count clamps instead of overshooting");
});

test("w b e know word, punctuation and blank classes, and cross lines", () => {
    const state = Vim.createState(["the crypt * door", "", "  damp-stair end"]);
    play(state, "w");
    assert.deepEqual(at(state), [0, 4]);
    play(state, "w");
    assert.deepEqual(at(state), [0, 10], "a lone * is a word of its own");
    play(state, "w");
    assert.deepEqual(at(state), [0, 12]);
    play(state, "w");
    assert.deepEqual(at(state), [1, 0], "an empty line is a word");
    play(state, "w");
    assert.deepEqual(at(state), [2, 2]);
    play(state, "w");
    assert.deepEqual(at(state), [2, 6], "- splits damp-stair");
    play(state, "e");
    assert.deepEqual(at(state), [2, 11]);
    play(state, "e");
    assert.deepEqual(at(state), [2, 15]);
    play(state, "w");
    assert.deepEqual(at(state), [2, 15], "w at the end of the buffer stays on the last char");
    play(state, "b");
    assert.deepEqual(at(state), [2, 13]);
    play(state, "3b");
    assert.deepEqual(at(state), [2, 2]);
    play(state, "b");
    assert.deepEqual(at(state), [1, 0]);
    play(state, "b");
    assert.deepEqual(at(state), [0, 12]);
    play(state, "W");
    assert.deepEqual(at(state), [1, 0], "W treats punctuation as part of the WORD");
    play(state, "gg0");
    assert.deepEqual(at(state), [0, 0]);
    assert.equal(play(state, "b")[0].error.code, "fail", "b at the start of the buffer fails");
});

test("0 ^ $ gg G and counts", () => {
    const state = Vim.createState(["   first", "second", "third", "   last"]);
    play(state, "$");
    assert.deepEqual(at(state), [0, 7]);
    play(state, "0");
    assert.deepEqual(at(state), [0, 0]);
    play(state, "^");
    assert.deepEqual(at(state), [0, 3]);
    play(state, "G");
    assert.deepEqual(at(state), [3, 3], "G lands on the first non-blank of the last line");
    play(state, "gg");
    assert.deepEqual(at(state), [0, 3]);
    play(state, "3G");
    assert.deepEqual(at(state), [2, 0]);
    play(state, "2gg");
    assert.deepEqual(at(state), [1, 0]);
    play(state, "2j");
    assert.deepEqual(at(state), [3, 0]);
    play(state, "2$");
    assert.deepEqual(at(state), [3, 6], "2$ stays within the buffer");
});

test("f t F T ; and , find within the line", () => {
    const state = Vim.createState(["a.b.c.d!e"]);
    play(state, "f.");
    assert.deepEqual(at(state), [0, 1]);
    play(state, "2;");
    assert.deepEqual(at(state), [0, 5], "a count on ; repeats twice");
    play(state, ",");
    assert.deepEqual(at(state), [0, 3]);
    assert.equal(play(state, "2;")[1].error.code, "fail", "a count past the last match fails in place");
    assert.deepEqual(at(state), [0, 3]);
    play(state, "t!");
    assert.deepEqual(at(state), [0, 6], "t stops one short");
    assert.equal(play(state, "t!")[1].error.code, "fail", "t onto an adjacent char does not move");
    play(state, "0");
    assert.equal(play(state, "Fa")[1].error.code, "fail", "nothing before column 0");
    assert.equal(play(state, "Ta")[1].error.code, "fail");
    play(state, "$Fb");
    assert.deepEqual(at(state), [0, 2]);
    play(state, "$T.");
    assert.deepEqual(at(state), [0, 6]);
    assert.equal(play(state, "fz")[1].error.code, "fail", "an absent char fails");
    assert.deepEqual(at(state), [0, 6]);
});

test("x X p P and the register swap characters", () => {
    const state = Vim.createState(["teh gate"]);
    play(state, "l");
    play(state, "x");
    assert.deepEqual(state.lines, ["th gate"]);
    assert.deepEqual(state.register, { text: ["e"], linewise: false });
    play(state, "p");
    assert.deepEqual(state.lines, ["the gate"]);
    assert.deepEqual(at(state), [0, 2], "the cursor rests on the pasted text");
    play(state, "$X");
    assert.deepEqual(state.lines, ["the gae"]);
    play(state, "P");
    assert.deepEqual(state.lines, ["the gate"]);
    play(state, "03x");
    assert.deepEqual(state.lines, [" gate"]);
    play(state, "$3p");
    assert.deepEqual(state.lines, [" gatethethethe"]);
    assert.equal(play(Vim.createState([""]), "x")[0].applied, false, "x on an empty line does nothing");
});

test("dd yy p P move whole lines", () => {
    const state = Vim.createState(["second", "first", "third"]);
    play(state, "ddp");
    assert.deepEqual(state.lines, ["first", "second", "third"]);
    assert.deepEqual(at(state), [1, 0]);
    play(state, "jyyP");
    assert.deepEqual(state.lines, ["first", "second", "third", "third"]);
    assert.deepEqual(at(state), [2, 0]);
    play(state, "2dd");
    assert.deepEqual(state.lines, ["first", "second"]);
    assert.deepEqual(state.register, { text: ["third", "third"], linewise: true });
    assert.deepEqual(at(state), [1, 0], "dd at the end moves up");
    play(state, "dddd");
    assert.deepEqual(state.lines, [""], "the buffer never loses its last line");
    play(state, "Yp");
    assert.deepEqual(state.lines, ["", ""]);
});

test("d with a motion: dw stays on its line, cw acts like ce, D cuts to the end", () => {
    const state = Vim.createState(["the junk key junk", "gate waits beyond"]);
    play(state, "wdw");
    assert.deepEqual(state.lines, ["the key junk", "gate waits beyond"]);
    play(state, "wdw");
    assert.deepEqual(state.lines, ["the key ", "gate waits beyond"], "dw on the last word does not pull the next line up");
    play(state, "0d2w");
    assert.deepEqual(state.lines, ["", "gate waits beyond"], "d2w across the line's words");
    play(state, "jwD");
    assert.deepEqual(state.lines, ["", "gate "]);
    play(state, "0cw");
    assert.equal(state.mode, "insert");
    assert.deepEqual(state.lines, ["", " "], "cw changed only the word, keeping the blank");
    play(state, "hall<esc>");
    assert.deepEqual(state.lines, ["", "hall "]);
    assert.equal(state.mode, "normal");
    play(state, "0de");
    assert.deepEqual(state.lines, ["", " "]);
    play(state, "cc");
    assert.equal(state.mode, "insert");
    play(state, "x<esc>");
    assert.deepEqual(state.lines, ["", "x"]);
    play(state, "kdj");
    assert.deepEqual(state.lines, [""], "dj is linewise over two lines");
    const last = Vim.createState(["one two"]);
    play(last, "wdw");
    assert.deepEqual(last.lines, ["one "], "dw on the buffer's last word takes the whole word");
    const tail = Vim.createState(["abc def"]);
    play(tail, "lld$");
    assert.deepEqual(tail.lines, ["ab"], "d$ is inclusive of the last character");
});

test("insert mode: i a I A o O, typing, Enter, Backspace, Escape steps back", () => {
    const state = Vim.createState(["gate"]);
    play(state, "Ithe <esc>");
    assert.deepEqual(state.lines, ["the gate"]);
    assert.deepEqual(at(state), [0, 3], "Escape moves one left");
    play(state, "A now<esc>");
    assert.deepEqual(state.lines, ["the gate now"]);
    assert.deepEqual(at(state), [0, 11]);
    play(state, "oand enter<esc>");
    assert.deepEqual(state.lines, ["the gate now", "and enter"]);
    play(state, "Oopen<esc>");
    assert.deepEqual(state.lines, ["the gate now", "open", "and enter"]);
    play(state, "a,<cr>sesame<esc>");
    assert.deepEqual(state.lines, ["the gate now", "open,", "sesame", "and enter"]);
    assert.deepEqual(at(state), [2, 5]);
    play(state, "0i<bs><esc>");
    assert.deepEqual(state.lines, ["the gate now", "open,sesame", "and enter"], "Backspace at column 0 joins the lines");
    assert.deepEqual(at(state), [1, 4]);
    play(state, "0i:/?<bs><esc>");
    assert.deepEqual(state.lines, ["the gate now", ":/open,sesame", "and enter"], ": and / are plain text while inserting");
    assert.equal(Vim.feed(state, "Enter").consumed, false, "Enter is not an editor key in normal mode");
    assert.equal(Vim.feed(state, "ArrowUp").consumed, false);
});

test("u undoes one change at a time, an insert session counting as one", () => {
    const state = Vim.createState(["abc"]);
    play(state, "x");
    play(state, "Axyz<esc>");
    play(state, "oline<esc>");
    assert.deepEqual(state.lines, ["bcxyz", "line"]);
    play(state, "u");
    assert.deepEqual(state.lines, ["bcxyz"]);
    play(state, "u");
    assert.deepEqual(state.lines, ["bc"]);
    play(state, "u");
    assert.deepEqual(state.lines, ["abc"]);
    assert.deepEqual(at(state), [0, 0]);
    const empty = play(state, "u")[0];
    assert.equal(empty.applied, false);
    assert.equal(empty.error.code, "fail");
    play(state, "cwzzz<esc>u");
    assert.deepEqual(state.lines, ["abc"], "a change command and its insert undo together");
});

test("r ~ and J edit in place", () => {
    const state = Vim.createState(["?ello", "  world"]);
    play(state, "rh");
    assert.deepEqual(state.lines, ["hello", "  world"]);
    play(state, "3~");
    assert.deepEqual(state.lines, ["HELlo", "  world"]);
    assert.deepEqual(at(state), [0, 3]);
    assert.equal(play(state, "2rx")[2].applied, true);
    assert.deepEqual(state.lines, ["HELxx", "  world"]);
    assert.equal(play(state, "$2rx")[2].applied, false, "r refuses to run past the line");
    play(state, "J");
    assert.deepEqual(state.lines, ["HELxx world"]);
    assert.deepEqual(at(state), [0, 5], "the cursor sits on the joining space");
});

test("/ searches literally with wrap-around; n and N repeat", () => {
    const state = Vim.createState(["where the first * lies", "none remember", "nor the * that lit", "the last * sleeps"]);
    play(state, "jj");
    assert.deepEqual(Vim.search(state, "*"), { found: true, wrapped: false });
    assert.deepEqual(at(state), [2, 8]);
    play(state, "n");
    assert.deepEqual(at(state), [3, 9]);
    const wrapped = play(state, "n")[0];
    assert.equal(wrapped.applied, true);
    assert.deepEqual(at(state), [0, 16], "n wraps to the top");
    play(state, "N");
    assert.deepEqual(at(state), [3, 9], "N reverses, wrapping the other way");
    assert.deepEqual(Vim.search(state, "nothing"), { found: false, wrapped: false });
    assert.deepEqual(at(state), [3, 9]);
    assert.deepEqual(Vim.search(state, "the", true), { found: true, wrapped: false });
    assert.deepEqual(at(state), [3, 0]);
    assert.deepEqual(Vim.search(state, "*", false), { found: true, wrapped: false });
    assert.deepEqual(at(state), [3, 9]);
    assert.deepEqual(Vim.search(state, "*", false), { found: true, wrapped: true });
    assert.deepEqual(at(state), [0, 16]);
    assert.deepEqual(Vim.search(state, "sleeps", true), { found: true, wrapped: true });
    assert.deepEqual(at(state), [3, 11]);
    assert.equal(play(Vim.createState(["x"]), "n")[0].error.code, "fail", "n before any search fails");
});

test("the spellbook: keys outside the allowed set are refused, early and late", () => {
    const state = Vim.createState(["one two", "three"]);
    const allowed = ["h", "j", "k", "l", "w", "dd"];
    const locked = play(state, "G", allowed)[0];
    assert.equal(locked.error.code, "locked");
    assert.equal(locked.error.key, "G");
    assert.deepEqual(at(state), [0, 0]);
    assert.equal(play(state, "3", allowed)[0].error.code, "locked", "a count is a key of its own");
    assert.equal(play(state, "0", allowed)[0].error.code, "locked", "0 is the line-start motion, not a count");
    const partial = play(state, "d", allowed)[0];
    assert.equal(partial.kind, "pending");
    assert.equal(partial.pending, "d");
    const dw = play(state, "w", allowed)[0];
    assert.equal(dw.error.code, "locked", "dd permits dd only, not d + motion");
    assert.equal(dw.error.key, "d");
    play(state, "dd", allowed);
    assert.deepEqual(state.lines, ["three"]);
    assert.equal(play(state, "D", ["d", "$"])[0].applied, true, "D is d$");
    assert.equal(play(state, "D", ["dd"])[0].error.code, "locked");
    const unknown = play(state, "Q", allowed)[0];
    assert.equal(unknown.error.code, "unknown", "a key vim does not have here is unknown, not locked");
    assert.equal(play(state, "%", null)[0].error.code, "unknown");
    assert.equal(play(state, "u", ["h"])[0].applied, true, "u is always allowed");
    assert.equal(play(state, "w", null)[0].applied, true, "no set means everything");
});

test("Escape cancels a pending command and is otherwise left to the host", () => {
    const state = Vim.createState(["abc"]);
    assert.equal(Vim.feed(state, "Escape").consumed, false);
    play(state, "2d");
    assert.equal(state.pending.length, 2);
    const cancel = Vim.feed(state, "Escape");
    assert.equal(cancel.consumed, true);
    assert.equal(cancel.kind, "cancel");
    assert.equal(state.pending.length, 0);
    const bad = play(state, "dx")[1];
    assert.equal(bad.error.code, "unknown");
    assert.equal(bad.error.key, "dx");
    assert.equal(state.pending.length, 0, "an invalid command clears the pending keys");
    const labelled = play(state, "3l")[1];
    assert.equal(labelled.command, "3l");
    assert.equal(labelled.kind, "motion");
});
