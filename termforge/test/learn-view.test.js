"use strict";
// The lesson Markdown renderer (web/assets/js/learn.js): the subset courses
// use, escaped, with clickable code. Loaded like the browser loads it —
// vendored core + runtime + hud + learn as classic scripts. The reader over
// it is a React component, covered by web/src/screens/LearnScreen.test.tsx.
const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const { RUNTIME_FILES, WEB_JS } = require("./helpers/game-harness.js");
const { loadClassic } = require("./helpers/load-classic.js");

function boot() {
    const env = loadClassic({ files: [...RUNTIME_FILES, path.join(WEB_JS, "hud.js"), path.join(WEB_JS, "learn.js")] });
    return { env, learn: env.sandbox.BashcrawlLearn };
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

test("the renderer is the whole public surface", () => {
    const { learn } = boot();
    assert.deepEqual(Object.keys(learn).sort(), ["inlineHtml", "renderMarkdown"]);
});
