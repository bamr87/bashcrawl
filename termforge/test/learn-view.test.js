"use strict";
// The web Learn mode (web/assets/js/learn.js): the lesson reader and the
// course catalogue as a view over the game runtime. Loaded like the browser
// loads it — vendored core + runtime + hud + learn as classic scripts — with
// a stand-in for the reader element.

const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");

const { RUNTIME_FILES, WEB_JS, loadGameData } = require("./helpers/game-harness.js");
const { loadClassic } = require("./helpers/load-classic.js");

function boot() {
    const env = loadClassic({ files: [...RUNTIME_FILES, path.join(WEB_JS, "hud.js"), path.join(WEB_JS, "learn.js")] });
    env.sandbox.__data = loadGameData();
    const runtime = env.run("new BashcrawlRuntime.Runtime(__data)");
    delete env.sandbox.__data;
    const reader = {
        innerHTML: "", scrollTop: 99, offsetWidth: 1, classes: new Set(),
        classList: { add(c) { reader.classes.add(c); }, remove(c) { reader.classes.delete(c); } },
    };
    const view = new env.sandbox.BashcrawlLearn.LearnView({ reader });
    const run = (line) => runtime.execute(line);
    return { env, runtime, reader, view, run, learn: env.sandbox.BashcrawlLearn };
}

test("renderMarkdown: the lesson subset, escaped, with clickable code", () => {
    const { learn } = boot();
    const html = learn.renderMarkdown([
        "A shell has a **current working directory** and `pwd` (*print working directory*) <shows> it.",
        "",
        "- `cd PATH` moves you",
        "- plain _emphasis_ and [a link](https://example.com)",
        "",
        "```",
        "cd /lab/navigator",
        "  pwd",
        "```",
        "## Heading",
        "Real world: globs like `*.txt` stay as typed, and 2 * 3 is arithmetic.",
    ].join("\n"));
    assert.match(html, /<strong>current working directory<\/strong>/);
    assert.match(html, /<code class="learn-code-inline" data-fill="pwd"[^>]*>pwd<\/code> \(<em>print working directory<\/em>\) &lt;shows&gt; it\./);
    assert.match(html, /<ul><li><code [^>]*data-fill="cd PATH"[^>]*>cd PATH<\/code> moves you<\/li><li>plain <em>emphasis<\/em> and <a href="https:\/\/example.com" target="_blank" rel="noopener noreferrer">a link<\/a><\/li><\/ul>/);
    assert.match(html, /<pre class="learn-code"><code><span class="learn-code-line" data-fill="cd \/lab\/navigator">cd \/lab\/navigator<\/span>\n<span class="learn-code-line" data-fill="pwd">  pwd<\/span><\/code><\/pre>/);
    assert.match(html, /<h4>Heading<\/h4>/);
    assert.match(html, /<p class="learn-callout"><strong>Real world:<\/strong> globs like <code [^>]*data-fill="\*\.txt"[^>]*>\*\.txt<\/code> stay as typed, and 2 \* 3 is arithmetic\.<\/p>/);
    // Hostile lesson text cannot inject markup.
    assert.equal(learn.renderMarkdown("<img src=x onerror=alert(1)>").includes("<img"), false);
    assert.equal(learn.renderMarkdown("[x](javascript:alert)"), "<p>x</p>", "only http(s) links become anchors");
});

test("the reader shows the catalogue, then the lesson, and repaints only when the model changes", () => {
    const { runtime, reader, view, run } = boot();
    assert.equal(view.render(runtime), true);
    const cards = reader.innerHTML.match(/class="learn-card /g) || [];
    assert.equal(cards.length, runtime.courses.length);
    assert.match(reader.innerHTML, /data-run="learn navigator"/);
    assert.match(reader.innerHTML, /learn-level-beginner">beginner</);
    assert.match(reader.innerHTML, /best after Finding Your Way/);
    assert.equal(reader.scrollTop, 0, "a new page scrolls to the top");
    assert.ok(reader.classes.has("is-entering"));

    run("ls");
    assert.equal(view.render(runtime), false, "an unrelated command leaves the reader alone");

    run("learn navigator");
    assert.equal(view.render(runtime), true);
    assert.match(reader.innerHTML, /<h2>Where am I\?<\/h2>/);
    assert.match(reader.innerHTML, /Lesson 1 of 5/);
    assert.match(reader.innerHTML, /<ol class="learn-outline"[^>]*><li class="is-current"/);
    assert.match(reader.innerHTML, /<article class="learn-body"><p>A shell always has a <strong>current working directory<\/strong>/);
    assert.match(reader.innerHTML, /class="obj-open"><span class="obj-mark">○<\/span>/);
    assert.match(reader.innerHTML, /data-run="cd \/lab\/navigator"/, "the Go to the lab chip shows outside the lab");
    assert.match(reader.innerHTML, /data-run="lesson hint"/);

    reader.scrollTop = 42;
    run("cd /lab/navigator");
    assert.equal(view.render(runtime), true);
    assert.match(reader.innerHTML, /class="obj-met is-new"><span class="obj-mark">✔<\/span>/, "a freshly met objective is flagged");
    assert.doesNotMatch(reader.innerHTML, /data-run="cd \/lab\/navigator"/, "inside the lab the chip goes away");
    assert.equal(reader.scrollTop, 42, "the same page keeps its scroll position");
    assert.match(reader.innerHTML, /1\/2<\/span>/);

    run("pwd");
    assert.equal(view.render(runtime), true);
    assert.match(reader.innerHTML, /<h2>Look around<\/h2>/, "a completed lesson hands over to the next");
    assert.match(reader.innerHTML, /<li class="is-done"/);
});

test("a finished course shows the remaining courses; quitting shows the catalogue again", () => {
    const { runtime, reader, view, run } = boot();
    run("learn navigator");
    runtime.state = { ...runtime.state, learn: { ...runtime.state.learn, progress: { navigator: { lesson: 4, met: [], done: ["where-am-i", "look-around", "walking", "going-up", "finding-things"], complete: true } } } };
    assert.equal(view.render(runtime), true);
    assert.match(reader.innerHTML, /<h2>✅ Finding Your Way complete<\/h2>/);
    assert.match(reader.innerHTML, /<h3>Keep going<\/h3>/);
    assert.doesNotMatch(reader.innerHTML, /data-run="learn navigator"/);
    run("learn quit");
    view.render(runtime);
    assert.match(reader.innerHTML, /<h2>Guided courses<\/h2>/);
    assert.match(reader.innerHTML, /learn-card-done/);
});
