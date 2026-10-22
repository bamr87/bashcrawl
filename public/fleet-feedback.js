/*!
 * fleet-feedback v0.2.0 — the universal "Improve this page" widget.
 * Source: bamr87/bamr87 templates/feedback/ (spec: specs/FEEDBACK.md, UPS-FB).
 *
 * Zero dependencies. One file, three layers, each usable on its own:
 *
 *   1. the console/error capture buffer  (byte-identical to capture.js)
 *   2. window.FleetFeedbackCore          the issue contract, as pure functions
 *   3. <fleet-feedback>                  the default shadow-DOM dialog + FAB
 *
 * A host with its own UI — the zer0-mistakes Jekyll theme's Bootstrap modal —
 * loads this file for layers 1 and 2 and never writes the tag, so both widgets
 * file byte-identical issues. Everything else writes the tag and gets layer 3.
 *
 *   <script src="/assets/js/fleet-feedback-capture.js"></script>   <!-- in <head> -->
 *   <script src="/assets/js/fleet-feedback.js" defer></script>     <!-- before </body> -->
 *   <fleet-feedback repo="owner/name" branch="main" source="pages/about.md"></fleet-feedback>
 *
 * Attributes (all optional except repo): repo, branch, source, route,
 * page-title, labels (csv markers, default "page-feedback"), assignee (default
 * "copilot"; "" disables), mode ("url" | "proxy" | "postmessage"), endpoint,
 * capture-logs, log-limit (40), fab, label, env, app-version, types (URL of a
 * JSON array). Inline taxonomy: <script type="application/json"> child.
 *
 * JS API: window.FleetFeedback.open({ type, description, extra })
 *         window.FleetFeedback.breadcrumb('net', 'GET /api/x -> 502')
 *         window.FleetFeedbackCore.buildIssue({...}) -> { title, body, labels }
 *         any element with [data-fleet-feedback-open] (+ data-type) opens it.
 */

/* ---------------------------------------------------------------------- */
/* 1. Console + error capture.                                             */
/*                                                                        */
/* This block is BYTE-IDENTICAL to capture.js, which exists so a host can  */
/* install the buffer high in <head> without paying for the whole widget   */
/* (tests/contract.test.mjs fails if the two ever diverge). Loading both   */
/* is the intended install: the early copy wins, this one is a no-op.      */
/* ---------------------------------------------------------------------- */
(function (root) {
  // Whether the buffer already existed tells us whether capture.js ran first.
  // If it did not, capture starts now — after page load — and the dialog says
  // so rather than implying it saw the errors it structurally could not.
  root.__fleetFeedbackWasEarly = !!(root.__fleetFeedback && root.__fleetFeedback.installed);
})(typeof window !== 'undefined' ? window : globalThis);

/* fleet-feedback:capture:begin — byte-identical in fleet-feedback.js (tests/contract.test.mjs asserts it) */
(function (root) {
  'use strict';

  var VERSION = '0.2.0';
  var LIMIT = 40;
  var MAX_ENTRY = 600;

  var g = (root.__fleetFeedback = root.__fleetFeedback || {
    logs: [],
    limit: LIMIT,
    installed: false,
    version: VERSION
  });
  if (g.installed) { return; }

  // Secrets end up in console output far more often than anyone expects — an
  // Authorization header logged by a fetch wrapper, a signed URL in a 403, a
  // user's address in a validation message. Redact BEFORE the line enters the
  // buffer, so it can never be previewed, copied, or filed.
  var SCRUB = [
    // The credential can carry a scheme word of its own ("Authorization: Bearer
    // <token>"), and a rule that stops at the scheme leaves the secret in the
    // buffer — which is exactly what the first version of this did.
    [/\b(authorization|proxy-authorization|bearer|token|api[-_]?key|access[-_]?token|refresh[-_]?token|client[-_]?secret|secret|password|passwd)(\s*[:=]\s*|\s+)((?:bearer|basic|digest|token)\s+)?([^\s,;"'&]{6,})/gi, '$1$2$3***'],
    [/\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]+/g, '***jwt***'],
    [/\bgh[pousr]_[A-Za-z0-9]{16,}/g, '***github-token***'],
    [/\bsk-[A-Za-z0-9_-]{16,}/g, '***api-key***'],
    [/\b[\w.+-]+@[\w-]+\.[\w.-]{2,}\b/g, '***@***']
  ];

  function redact(text) {
    var out = String(text == null ? '' : text);
    for (var i = 0; i < SCRUB.length; i++) {
      out = out.replace(SCRUB[i][0], SCRUB[i][1]);
    }
    return out;
  }

  function stringify(value) {
    if (typeof value === 'string') { return value; }
    if (value instanceof Error) {
      return (value.name || 'Error') + ': ' + (value.message || '') +
        (value.stack ? '\n' + String(value.stack).split('\n').slice(1, 4).join('\n') : '');
    }
    try { return JSON.stringify(value); } catch (e) { return String(value); }
  }

  function push(level, parts) {
    try {
      var line = redact(parts.map(stringify).join(' '));
      if (line.length > MAX_ENTRY) { line = line.slice(0, MAX_ENTRY) + '…'; }
      g.logs.push({ t: new Date().toISOString(), level: level, msg: line });
      while (g.logs.length > g.limit) { g.logs.shift(); }
    } catch (e) { /* capture must never break the page it is watching */ }
  }

  // Only warn/error are hooked. console.log is noise at this budget — 40 lines
  // of debug chatter push the actual failure out of a ring this size.
  if (root.console) {
    ['warn', 'error'].forEach(function (level) {
      var original = root.console[level];
      root.console[level] = function () {
        push(level, Array.prototype.slice.call(arguments));
        if (original) { return original.apply(root.console, arguments); }
      };
    });
  }

  if (root.addEventListener) {
    root.addEventListener('error', function (e) {
      if (!e) { return; }
      var where = e.filename ? ' (' + e.filename + ':' + (e.lineno || 0) + ':' + (e.colno || 0) + ')' : '';
      push('error', [(e.message || 'Uncaught error') + where]);
    });
    root.addEventListener('unhandledrejection', function (e) {
      var reason = e && e.reason;
      push('error', ['Unhandled promise rejection:', reason && reason.message ? reason.message : reason]);
    });
  }

  g.version = VERSION;
  g.installed = true;
  g.redact = redact;
  /**
   * Push a structured entry. An app's fetch wrapper calls this on a failed
   * request so the report carries the API call that broke, not just the
   * exception it surfaced as:
   *   FF.breadcrumb('net', 'GET /api/analysis → 502 (1243ms) req=abc123')
   */
  g.breadcrumb = function (level, message) { push(level || 'net', [message]); };
  g.snapshot = function () { return g.logs.slice(); };
  g.clear = function () { g.logs.length = 0; };
})(typeof window !== 'undefined' ? window : globalThis);
/* fleet-feedback:capture:end */

(function (root) {
  if (root.__fleetFeedback) { root.__fleetFeedback.late = !root.__fleetFeedbackWasEarly; }
})(typeof window !== 'undefined' ? window : globalThis);

/* ---------------------------------------------------------------------- */
/* 2. FleetFeedbackCore — the issue contract, as pure functions.           */
/*                                                                        */
/* Everything here takes an explicit input object and returns strings. No  */
/* DOM, no globals, no I/O — so it runs under Node in the contract tests,  */
/* and so a host with its own UI (the zer0-mistakes theme's Bootstrap      */
/* modal) can produce a byte-identical issue by calling the same builder   */
/* instead of reimplementing it. Two UIs, one contract.                    */
/* Spec: specs/FEEDBACK.md UPS-FB-20..25.                                  */
/* ---------------------------------------------------------------------- */
(function (root) {
  'use strict';

  var VERSION = '0.2.0';

  // Pre-filled github.com/issues/new URLs stop working reliably somewhere near
  // 8k (browser and GitHub both weigh in). Budget below that and trim to fit.
  var URL_BUDGET = 7000;
  var SECTION_ORDER = ['description', 'context', 'environment', 'logs', 'directive', 'footer'];
  // Dropped in this order when the URL is over budget: logs are reproducible,
  // the directive is regenerable from the type, the environment table is the
  // last thing an agent needs. Description and page context never go.
  var TRIM_ORDER = ['logs', 'directive', 'environment'];
  var MARKER_RE = /<!-- fleet-feedback v1 type=([a-z0-9-]+) -->/;

  /* Request-type taxonomy — mirrors templates/feedback/feedback_types.yml.
     Type labels come from the fleet issue-pipeline set (_data/fleet.yml
     issue_pipeline.labels.types) plus optional area:*, so a widget-filed issue
     is pipeline-eligible on the next scan. EVERY label must already exist in
     the target repo: GitHub silently drops unknown labels from a prefilled
     URL — no error, no warning, the label is just gone. */
  var DEFAULT_TYPES = [
    { id: 'fix-page', label: 'Report a problem', group: 'This page', scope: 'page', description: 'A typo, broken link, wrong information, or something rendering badly', labels: ['bug'], agent: true, directive: 'Reproduce and fix the reported defect on the page identified in Page context. Keep the change minimal and surgical; verify with the project build.', placeholder: 'What is wrong, where on the page, and what did you expect instead?' },
    { id: 'improve-page', label: 'Improve this page', group: 'This page', scope: 'page', description: 'Polish the copy, structure, or presentation', labels: ['docs'], agent: true, directive: 'Act as a content editor for the page in Page context. Tighten copy, fix grammar, improve heading hierarchy — without changing the core message or breaking links.', placeholder: 'What would make this page clearer, tighter, or more useful?' },
    { id: 'expand-page', label: 'Add missing detail', group: 'This page', scope: 'page', description: 'Add depth, examples, or a section a reader would expect', labels: ['docs'], agent: true, directive: 'Expand the page in Page context with concrete examples, prerequisites, and any expected-but-missing sections. Preserve tone and front matter.', placeholder: 'What is missing? Which examples or sections would help?' },
    { id: 'update-page', label: 'Flag outdated content', group: 'This page', scope: 'page', description: 'Stale versions, dead links, or old screenshots', labels: ['docs'], agent: true, directive: 'Audit the page in Page context for stale versions, dead links, and outdated screenshots; refresh them and bump lastmod.', placeholder: 'What is out of date? Paste the stale value or link if you can.' },
    { id: 'accessibility', label: 'Accessibility issue', group: 'This page', scope: 'page', description: 'Contrast, keyboard, screen-reader, or focus problems', labels: ['bug', 'area:a11y'], agent: true, directive: 'Audit the page in Page context against WCAG 2.1 AA for the reported barrier (contrast, keyboard, focus, ARIA, alt text) and propose concrete fixes.', placeholder: 'What barrier did you hit? Which assistive tech or input method?' },
    { id: 'ui-ux', label: 'UI / UX improvement', group: 'The site', scope: 'site', description: 'A design or usability refinement', labels: ['feature'], agent: true, directive: 'Propose a token-first UI/UX refinement using the page in Page context as the starting example. Cover responsive behaviour, dark mode, and accessibility.', placeholder: 'What feels off, and how might it look or behave instead?' },
    { id: 'performance', label: 'Performance', group: 'The site', scope: 'site', description: 'Slow load, layout shift, or heavy assets', labels: ['bug', 'area:perf'], agent: true, directive: 'Profile the page in Page context (LCP, CLS, INP), identify the bottleneck, and propose fixes.', placeholder: 'What felt slow? On what device / connection?' },
    { id: 'feature', label: 'Feature request', group: 'The site', scope: 'site', description: 'Propose a new capability', labels: ['feature'], agent: false, directive: '', placeholder: 'What should it do, and who benefits?' },
    { id: 'question', label: 'Ask a question', group: 'The site', scope: 'site', description: 'Something unclear — not necessarily a bug', labels: ['question'], agent: false, directive: '', placeholder: 'What are you trying to do, and where did you get stuck?' }
  ];

  /* Escape a value for a Markdown table cell. Backslashes MUST go first:
     escaping "|" to "\|" and only then escaping backslashes would double the
     one we just added and corrupt the row. */
  function cell(value) {
    return String(value == null ? '' : value)
      .replace(/\\/g, '\\\\')
      .replace(/\|/g, '\\|')
      .replace(/\r?\n/g, ' ');
  }

  function uniq(list) {
    var seen = {}, out = [];
    (list || []).forEach(function (item) {
      if (item && !Object.prototype.hasOwnProperty.call(seen, item)) { seen[item] = 1; out.push(item); }
    });
    return out;
  }

  function typeById(types, id) {
    var list = types || DEFAULT_TYPES;
    for (var i = 0; i < list.length; i++) { if (list[i].id === id) { return list[i]; } }
    return null;
  }

  function formatLogs(logs) {
    return (logs || []).map(function (l) {
      return (l.t || '') + ' [' + (l.level || 'log') + '] ' + (l.msg || l.text || '');
    }).join('\n');
  }

  /* Rows are [label, value, raw?] triples; falsy values drop the row so an
     absent field is absent rather than an empty cell. `raw` values are already
     markdown (a link) and skip escaping. */
  function table(rows) {
    var body = rows.filter(function (r) { return r && r[1]; }).map(function (r) {
      return '| **' + r[0] + '** | ' + (r[2] ? r[1] : cell(r[1])) + ' |';
    });
    return body.length ? ['| Field | Value |', '|---|---|'].concat(body).join('\n') : '';
  }

  function extraRows(rows) {
    return (rows || []).map(function (r) { return [r[0], r[1]]; });
  }

  /**
   * Build the issue. Pure: same input, same bytes, in a browser or in Node.
   *
   * input = {
   *   type:        taxonomy entry (required)
   *   description: the reader's own words
   *   extra:       appended to the description — an error stack, a missing route
   *   page:        { title, url, source, sourceUrl, route, lastmod, rows: [[k,v]] }
   *   environment: { browser, viewport, dpr, colorScheme, reducedMotion,
   *                  referrer, repository, branch, buildEnv, capturedAt, rows }
   *   logs:        [{ t, level, msg }]
   *   config:      { labels: [marker labels], assignee: 'copilot' }
   * }
   */
  function buildIssue(input) {
    var inp = input || {};
    var type = inp.type || DEFAULT_TYPES[0];
    var page = inp.page || {};
    var env = inp.environment || {};
    var cfg = inp.config || {};
    var logs = inp.logs || [];
    var desc = String(inp.description || '').trim();
    var s = {};

    s.description = '## 📝 Description\n\n' + (desc || '_(no description provided)_') +
      (inp.extra ? '\n\n' + inp.extra : '');

    s.context = '## 📄 Page context\n\n' + table([
      ['Page', page.title],
      ['URL', page.url],
      ['Source', page.sourceUrl && page.source ? '[`' + cell(page.source) + '`](' + page.sourceUrl + ')' : page.source, true],
      ['Collection/route', page.route],
      ['Last modified', page.lastmod]
    ].concat(extraRows(page.rows)));

    s.environment = '## 🔧 Environment\n\n' + table([
      ['Browser', env.browser],
      ['Viewport', env.viewport ? env.viewport + ' @' + (env.dpr || 1) + 'x' : ''],
      ['Colour scheme', env.colorScheme ? env.colorScheme + (env.reducedMotion ? ', reduced motion' : '') : ''],
      ['Referrer', env.referrer],
      ['Repository', cfg.repo || env.repository],
      ['Branch', env.branch],
      ['Build env', env.buildEnv],
      ['Captured at', env.capturedAt]
    ].concat(extraRows(env.rows)));

    /* Fenced inside <details> so a 40-line buffer does not bury the report.
       A ``` inside a captured line would close the fence early — neutralise it. */
    s.logs = logs.length
      ? '## 🧾 Console & error logs\n\n<details>\n<summary>' + logs.length + ' captured line(s)</summary>\n\n' +
        '```text\n' + formatLogs(logs).replace(/```/g, "'''") + '\n```\n\n</details>'
      : '';

    s.directive = type.agent && type.directive
      ? '## 🤖 Agent directive\n\n' + type.directive
      : '';

    /* The marker is what makes a filed issue machine-recognisable: the issue
       pipeline's intake tier reads it and skips re-templating a report that is
       already structured. Keep it last and keep it stable. */
    s.footer = '---\n_Filed from ' + (page.url || '') + ' via fleet-feedback v' + VERSION + '._\n' +
      '<!-- fleet-feedback v1 type=' + type.id + ' -->';

    var labels = uniq((cfg.labels || ['page-feedback']).concat(type.labels || []));
    var assignees = type.agent && cfg.assignee ? [cfg.assignee] : [];
    var title = ('[' + type.label + '] ' + (page.title || '')).trim().slice(0, 240);

    return {
      title: title,
      sections: s,
      body: assemble(s, []),
      labels: labels,
      assignees: assignees,
      marker: '<!-- fleet-feedback v1 type=' + type.id + ' -->',
      type: type
    };
  }

  function assemble(sections, skip) {
    var drop = skip || [];
    return SECTION_ORDER.filter(function (k) {
      return sections[k] && drop.indexOf(k) < 0;
    }).map(function (k) { return sections[k]; }).join('\n\n');
  }

  /**
   * Compose the prefilled issue URL, trimming sections until it fits the
   * budget. Always reports what was dropped so the caller can hand the full
   * body to the clipboard — nothing is ever silently lost (UPS-FB-06).
   */
  function buildUrl(issue, opts) {
    var o = opts || {};
    var budget = o.budget || URL_BUDGET;
    var base = 'https://github.com/' + (o.repo || '') + '/issues/new';
    var skip = [], url, i = 0;

    function compose() {
      var p = new URLSearchParams();
      p.set('title', issue.title);
      p.set('body', assemble(issue.sections, skip));
      if (issue.labels.length) { p.set('labels', issue.labels.join(',')); }
      if (issue.assignees.length) { p.set('assignees', issue.assignees.join(',')); }
      return base + '?' + p.toString();
    }

    url = compose();
    while (url.length > budget && i < TRIM_ORDER.length) {
      skip.push(TRIM_ORDER[i++]);
      url = compose();
    }
    return {
      url: url,
      trimmed: skip,
      overBudget: url.length > budget,
      fullBody: assemble(issue.sections, [])
    };
  }

  /* Browser-only convenience: everything about the environment the page can
     see for itself. Never includes identity, IP, cookies, or form contents
     (UPS-FB-08). */
  function collectEnvironment(extra) {
    var e = extra || {};
    var mm = typeof window !== 'undefined' && window.matchMedia;
    return {
      browser: typeof navigator !== 'undefined' ? navigator.userAgent : '',
      viewport: typeof window !== 'undefined' ? window.innerWidth + '×' + window.innerHeight : '',
      dpr: (typeof window !== 'undefined' && window.devicePixelRatio) || 1,
      colorScheme: mm && mm('(prefers-color-scheme: dark)').matches ? 'dark' : 'light',
      reducedMotion: !!(mm && mm('(prefers-reduced-motion: reduce)').matches),
      referrer: (typeof document !== 'undefined' && document.referrer) || '',
      repository: e.repository || '',
      branch: e.branch || '',
      buildEnv: e.buildEnv || '',
      capturedAt: new Date().toISOString(),
      rows: e.rows || []
    };
  }

  var Core = {
    VERSION: VERSION,
    URL_BUDGET: URL_BUDGET,
    SECTION_ORDER: SECTION_ORDER,
    TRIM_ORDER: TRIM_ORDER,
    MARKER_RE: MARKER_RE,
    TYPES: DEFAULT_TYPES,
    cell: cell,
    uniq: uniq,
    typeById: typeById,
    formatLogs: formatLogs,
    buildIssue: buildIssue,
    assemble: assemble,
    buildUrl: buildUrl,
    collectEnvironment: collectEnvironment
  };

  root.FleetFeedbackCore = Core;
  // CommonJS so tests/contract.test.mjs can require() this file directly —
  // the contract is verified against the same bytes the fleet ships.
  if (typeof module !== 'undefined' && module.exports) { module.exports = Core; }
})(typeof window !== 'undefined' ? window : globalThis);

/* ---------------------------------------------------------------------- */
/* 3. <fleet-feedback> — the default UI.                                   */
/*                                                                        */
/* Shadow DOM so a host page's CSS cannot break it and it cannot break the */
/* host's; native <dialog> so focus trapping, Escape, and the backdrop are */
/* the platform's job rather than ours. Renders ONLY where the tag is      */
/* placed — a host that wants its own dialog can load this file purely for */
/* the capture buffer and FleetFeedbackCore, and never write the tag.      */
/* ---------------------------------------------------------------------- */
(function (root) {
  'use strict';

  if (typeof document === 'undefined' || !root.customElements) { return; }
  if (customElements.get('fleet-feedback')) { return; }

  var Core = root.FleetFeedbackCore;
  var g = root.__fleetFeedback;
  var VERSION = Core.VERSION;

  function bool(v, d) { return v == null ? d : (v !== 'false' && v !== '0'); }
  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }

  /* Tokens first, each falling back to the zer0-mistakes/Bootstrap variable and
     then to a literal, so the widget looks native in a fleet app that ships the
     design tokens AND in a bare page that ships nothing. */
  var STYLE = [
    ':host{--_fg:var(--fleet-color-ink,var(--zer0-color-ink,var(--bs-body-color,#1b1f23)));',
    '--_bg:var(--fleet-color-bg-elevated,var(--zer0-color-bg-elevated,var(--bs-body-bg,#fff)));',
    '--_muted:var(--fleet-color-ink-muted,var(--zer0-color-ink-muted,#6c757d));',
    '--_border:var(--fleet-color-border,var(--zer0-color-border,#dee2e6));',
    '--_primary:var(--fleet-color-primary,var(--zer0-color-primary,var(--bs-primary,#0d6efd)));',
    '--_radius:var(--fleet-radius-lg,.5rem);--_shadow:var(--fleet-shadow-lg,0 1rem 3rem rgba(0,0,0,.18));',
    '--_focus:var(--fleet-shadow-focus,0 0 0 .25rem rgba(13,110,253,.35));',
    '--_fab-layer:var(--fleet-layer-fab-feedback,1051);--_modal-layer:var(--fleet-layer-feedback-modal,1096);',
    '--_offset:var(--fleet-space-fab-offset,1rem);--_size:var(--fleet-space-fab-size,3.5rem);',
    'font:400 1rem/1.55 var(--fleet-font-sans,system-ui,-apple-system,"Segoe UI",sans-serif);color:var(--_fg)}',
    '*{box-sizing:border-box}',
    '.fab{position:fixed;right:var(--_offset);bottom:calc(var(--_offset) + var(--fleet-space-fab-gap,.75rem) + var(--_size));',
    'z-index:var(--_fab-layer);width:var(--_size);height:var(--_size);border-radius:50%;border:0;background:var(--_primary);',
    'color:#fff;cursor:pointer;box-shadow:var(--_shadow);font-size:1.35rem;display:grid;place-items:center}',
    '.fab:focus-visible,button:focus-visible,textarea:focus-visible,input:focus-visible{outline:0;box-shadow:var(--_focus)}',
    'dialog{z-index:var(--_modal-layer);border:1px solid var(--_border);border-radius:var(--_radius);background:var(--_bg);',
    'color:var(--_fg);padding:0;width:min(40rem,calc(100vw - 2rem));max-height:calc(100vh - 2rem);box-shadow:var(--_shadow)}',
    'dialog::backdrop{background:rgba(0,0,0,.5)}',
    'form{display:flex;flex-direction:column;gap:1rem;padding:1.25rem;max-height:calc(100vh - 2rem);overflow:auto}',
    'header{display:flex;justify-content:space-between;align-items:flex-start;gap:1rem}',
    'h2{margin:0;font-size:1.2rem}.sub{margin:.25rem 0 0;font-size:.85rem;color:var(--_muted)}',
    '.close{background:none;border:0;font-size:1.5rem;line-height:1;cursor:pointer;color:var(--_muted);padding:0 .25rem}',
    'fieldset{border:0;padding:0;margin:0;display:grid;grid-template-columns:repeat(auto-fill,minmax(13rem,1fr));gap:.5rem}',
    'legend,.h{font-weight:600;margin:0 0 .5rem;padding:0;font-size:.95rem}',
    '.type{display:flex;gap:.5rem;align-items:flex-start;border:1px solid var(--_border);border-radius:var(--_radius);padding:.5rem .6rem;cursor:pointer}',
    '.type:has(input:checked){border-color:var(--_primary);box-shadow:inset 0 0 0 1px var(--_primary)}',
    '.type small{display:block;color:var(--_muted);font-size:.78rem;line-height:1.35}',
    '.type input{margin-top:.2rem;flex:none}',
    'textarea{width:100%;min-height:7rem;padding:.6rem;border:1px solid var(--_border);border-radius:var(--_radius);',
    'background:transparent;color:inherit;font:inherit;resize:vertical}',
    'details{border:1px solid var(--_border);border-radius:var(--_radius);padding:.5rem .75rem}',
    'summary{cursor:pointer;font-weight:600;font-size:.9rem}',
    'ul{margin:.5rem 0 0;padding-left:1.15rem;font-size:.82rem;color:var(--_muted)}li{margin:.15rem 0}',
    'pre{margin:.5rem 0 0;max-height:9rem;overflow:auto;font-size:.72rem;white-space:pre-wrap;word-break:break-word;',
    'background:rgba(127,127,127,.08);padding:.5rem;border-radius:var(--_radius)}',
    '.row{display:flex;gap:.5rem;align-items:center;flex-wrap:wrap}.grow{flex:1 1 8rem}',
    '.check{display:flex;gap:.4rem;align-items:center;margin-top:.5rem;font-size:.85rem}',
    '.btn{border:1px solid var(--_primary);border-radius:var(--_radius);padding:.5rem 1rem;font:inherit;',
    'cursor:pointer;background:var(--_primary);color:#fff}',
    '.btn[disabled]{opacity:.55;cursor:not-allowed}',
    '.btn.ghost{background:transparent;color:var(--_primary)}',
    '.status{font-size:.85rem;color:var(--_muted);min-height:1.2em}',
    '.status[data-kind="warn"]{color:var(--fleet-color-warning,#b45309)}',
    '.status[data-kind="ok"]{color:var(--fleet-color-success,#15803d)}',
    '@media (prefers-reduced-motion:no-preference){dialog[open]{animation:ff-in var(--fleet-motion-base,180ms) var(--fleet-ease,cubic-bezier(.2,0,0,1))}}',
    '@keyframes ff-in{from{opacity:0;transform:translateY(.5rem)}to{opacity:1;transform:none}}'
  ].join('');

  function FleetFeedback() {
    var self = Reflect.construct(HTMLElement, [], FleetFeedback);
    self._types = Core.TYPES;
    self._preset = {};
    return self;
  }
  FleetFeedback.prototype = Object.create(HTMLElement.prototype);
  FleetFeedback.prototype.constructor = FleetFeedback;

  FleetFeedback.prototype.config = function () {
    var a = this.getAttribute.bind(this);
    return {
      repo: a('repo') || '',
      branch: a('branch') || 'main',
      source: a('source') || '',
      route: a('route') || '',
      pageTitle: a('page-title') || document.title,
      labels: (a('labels') || 'page-feedback').split(',').map(function (s) { return s.trim(); }).filter(Boolean),
      assignee: a('assignee') == null ? 'copilot' : a('assignee'),
      mode: ['proxy', 'postmessage'].indexOf(a('mode')) >= 0 ? a('mode') : 'url',
      endpoint: a('endpoint') || '/api/feedback/issue',
      captureLogs: bool(a('capture-logs'), true),
      logLimit: parseInt(a('log-limit') || '40', 10) || 40,
      fab: bool(a('fab'), true),
      label: a('label') || 'Improve this page',
      env: a('env') || '',
      appVersion: a('app-version') || '',
      typesUrl: a('types') || ''
    };
  };

  FleetFeedback.prototype.connectedCallback = function () {
    var self = this;
    var cfg = this.config();
    if (g) { g.limit = cfg.logLimit; }

    var inline = this.querySelector('script[type="application/json"]');
    if (inline) {
      try { this._types = JSON.parse(inline.textContent); }
      catch (e) { console.warn('fleet-feedback: inline types JSON is invalid — using the built-in taxonomy'); }
    } else if (cfg.typesUrl && root.fetch) {
      root.fetch(cfg.typesUrl)
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (t) { if (Array.isArray(t) && t.length) { self._types = t; self._renderTypes(); } })
        .catch(function () { /* the built-in taxonomy is the fallback */ });
    }

    this._render(cfg);

    // Progressive enhancement, registered once for the document: any
    // [data-fleet-feedback-open] anchor anywhere becomes a dialog trigger, and
    // stays a working link to the issue form when this script never loads.
    if (!root.__fleetFeedbackDelegated) {
      root.__fleetFeedbackDelegated = true;
      document.addEventListener('click', function (e) {
        var t = e.target && e.target.closest && e.target.closest('[data-fleet-feedback-open]');
        if (!t || !root.FleetFeedback) { return; }
        e.preventDefault();
        root.FleetFeedback.open({
          type: t.getAttribute('data-type') || '',
          description: t.getAttribute('data-description') || ''
        });
      });
    }

    root.FleetFeedback = {
      open: function (o) { self.open(o || {}); },
      close: function () { self.close(); },
      breadcrumb: function (level, message) { if (g && g.breadcrumb) { g.breadcrumb(level, message); } },
      logs: g ? g.logs : [],
      core: Core,
      version: VERSION,
      element: self
    };
  };

  FleetFeedback.prototype._render = function (cfg) {
    var shadow = this.attachShadow({ mode: 'open' });
    shadow.innerHTML =
      '<style>' + STYLE + '</style>' +
      (cfg.fab
        ? '<button type="button" class="fab" aria-haspopup="dialog" aria-controls="ff-dlg" title="' +
          esc(cfg.label) + '" aria-label="' + esc(cfg.label) + '">&#x1F4E3;</button>'
        : '') +
      '<dialog id="ff-dlg" aria-labelledby="ff-title">' +
      '<form novalidate>' +
      '<header><div><h2 id="ff-title">' + esc(cfg.label) + '</h2>' +
      '<p class="sub" id="ff-sub">This becomes a GitHub issue on <code>' + esc(cfg.repo) + '</code> with the page details attached.</p></div>' +
      '<button type="button" class="close" id="ff-close" aria-label="Close">&times;</button></header>' +
      '<div><p class="h" id="ff-tl">What kind of request?</p>' +
      '<fieldset id="ff-types" aria-labelledby="ff-tl"></fieldset></div>' +
      '<div><label class="h" for="ff-desc">Describe it</label>' +
      '<textarea id="ff-desc" name="description" required aria-describedby="ff-help"></textarea>' +
      '<p class="sub" id="ff-help">Be specific — what you expected, what happened, or what would be better.</p></div>' +
      '<details id="ff-ctx-wrap"><summary>What will be attached <span id="ff-ctx-count"></span></summary>' +
      '<ul id="ff-ctx" aria-live="polite"></ul>' +
      '<label class="check"><input type="checkbox" id="ff-logs" checked> ' +
      '<span>Include captured console &amp; error logs (<span id="ff-nlogs">0</span>)</span></label>' +
      '<pre id="ff-logpre" tabindex="0" aria-label="Captured console and error logs" hidden></pre>' +
      '<p class="sub" id="ff-privacy">Captured in your browser only. Nothing is sent until you submit.</p>' +
      '</details>' +
      '<p class="status" id="ff-status" role="status" aria-live="polite"></p>' +
      '<div class="row"><button type="button" class="btn ghost" id="ff-copy">Copy details</button>' +
      '<span class="grow"></span>' +
      '<button type="button" class="btn ghost" id="ff-cancel">Cancel</button>' +
      '<button type="submit" class="btn" id="ff-submit">Open GitHub issue</button></div>' +
      '</form></dialog>';

    var $ = function (sel) { return shadow.querySelector(sel); };
    this._$ = $;
    this._renderTypes();

    var self = this;
    if (cfg.fab) { $('.fab').addEventListener('click', function () { self.open({}); }); }
    $('#ff-close').addEventListener('click', function () { self.close(); });
    $('#ff-cancel').addEventListener('click', function () { self.close(); });
    $('#ff-logs').addEventListener('change', function (e) {
      $('#ff-logpre').hidden = !e.target.checked;
      self._renderContextCount();
    });
    $('#ff-desc').addEventListener('input', function () { self._syncSubmit(); });
    $('#ff-copy').addEventListener('click', function () { self.copy(); });
    $('form').addEventListener('submit', function (e) { e.preventDefault(); self.submit(); });
    // <dialog> handles Escape and focus trapping; the backdrop is ours. The
    // click lands on the dialog itself when it hits the ::backdrop area.
    $('#ff-dlg').addEventListener('click', function (e) { if (e.target === $('#ff-dlg')) { self.close(); } });
    $('#ff-dlg').addEventListener('close', function () {
      if (self._opener && self._opener.focus) { self._opener.focus(); }
    });
  };

  FleetFeedback.prototype._renderTypes = function () {
    if (!this._$) { return; }
    var fs = this._$('#ff-types');
    fs.innerHTML = this._types.map(function (t, i) {
      return '<label class="type"><input type="radio" name="type" value="' + esc(t.id) + '"' +
        (i === 0 ? ' checked' : '') + ' aria-describedby="ff-d-' + esc(t.id) + '">' +
        '<span><strong>' + esc(t.label) + '</strong>' +
        '<small id="ff-d-' + esc(t.id) + '">' + esc(t.description || '') + '</small></span></label>';
    }).join('');
    var self = this;
    fs.addEventListener('change', function () { self._syncType(); });
    this._syncType();
  };

  FleetFeedback.prototype._type = function () {
    var checked = this._$('input[name=type]:checked');
    return Core.typeById(this._types, checked ? checked.value : '') || this._types[0];
  };

  FleetFeedback.prototype._syncType = function () {
    var t = this._type();
    if (t) { this._$('#ff-desc').placeholder = t.placeholder || ''; }
    var cfg = this.config();
    var submit = this._$('#ff-submit');
    if (t && t.agent && cfg.assignee) {
      submit.title = 'Files the issue and assigns @' + cfg.assignee;
    } else {
      submit.removeAttribute('title');
    }
    this._syncSubmit();
  };

  FleetFeedback.prototype._syncSubmit = function () {
    this._$('#ff-submit').disabled = !this._$('#ff-desc').value.trim();
  };

  FleetFeedback.prototype._logs = function () {
    var cfg = this.config();
    if (!cfg.captureLogs || !g) { return []; }
    return g.snapshot ? g.snapshot() : (g.logs || []).slice();
  };

  FleetFeedback.prototype._renderContextCount = function () {
    var el = this._$('#ff-ctx-count');
    if (!el) { return; }
    var n = this._$('#ff-ctx').children.length + (this._$('#ff-logs').checked ? 1 : 0);
    el.textContent = '(' + n + ')';
  };

  FleetFeedback.prototype.page = function (cfg) {
    return {
      title: cfg.pageTitle,
      url: location.href,
      source: cfg.source,
      sourceUrl: cfg.source && cfg.repo
        ? 'https://github.com/' + cfg.repo + '/blob/' + cfg.branch + '/' + cfg.source
        : '',
      route: cfg.route || (typeof location !== 'undefined' ? location.pathname : ''),
      lastmod: (document.querySelector('meta[property="article:modified_time"]') || {}).content || ''
    };
  };

  FleetFeedback.prototype.environment = function (cfg) {
    var rows = [];
    if (cfg.appVersion) { rows.push(['App version', cfg.appVersion]); }
    return Core.collectEnvironment({
      repository: cfg.repo,
      branch: cfg.branch,
      buildEnv: cfg.env,
      rows: rows
    });
  };

  FleetFeedback.prototype.buildIssue = function () {
    var cfg = this.config();
    return Core.buildIssue({
      type: this._type(),
      description: this._$('#ff-desc').value,
      extra: this._preset.extra || '',
      page: this.page(cfg),
      environment: this.environment(cfg),
      logs: this._$('#ff-logs').checked ? this._logs() : [],
      config: { labels: cfg.labels, assignee: cfg.assignee, repo: cfg.repo }
    });
  };

  FleetFeedback.prototype.open = function (opts) {
    var cfg = this.config();
    this._preset = opts || {};
    this._opener = document.activeElement;

    if (this._preset.type) {
      var radio = this._$('input[name=type][value="' + this._preset.type + '"]');
      if (radio) { radio.checked = true; }
    }
    this._syncType();
    if (this._preset.description) { this._$('#ff-desc').value = this._preset.description; }

    var page = this.page(cfg);
    var items = [
      'Page: ' + page.title,
      'URL: ' + page.url,
      page.source ? 'Source: ' + page.source : '',
      'Browser, viewport, colour scheme, referrer',
      'Repository: ' + cfg.repo + ' @ ' + cfg.branch
    ].filter(Boolean);
    this._$('#ff-ctx').innerHTML = items.map(function (s) { return '<li>' + esc(s) + '</li>'; }).join('');

    var logs = this._logs();
    var logsBox = this._$('#ff-logs');
    logsBox.disabled = logs.length === 0;
    logsBox.checked = logs.length > 0;
    this._$('#ff-nlogs').textContent = String(logs.length);
    this._$('#ff-logpre').textContent = Core.formatLogs(logs);
    this._$('#ff-logpre').hidden = logs.length === 0;
    // Honest about a late start: without capture.js in <head>, everything that
    // failed during page load happened before the hooks existed.
    this._$('#ff-privacy').textContent = (g && g.installed && !g.late)
      ? 'Captured in your browser only. Nothing is sent until you submit.'
      : 'Capture started after page load — earlier errors are not included. Nothing is sent until you submit.';
    this._renderContextCount();

    this._status('');
    this._$('#ff-submit').textContent = cfg.mode === 'url' ? 'Open GitHub issue' : 'File issue';
    this._syncSubmit();

    var dlg = this._$('#ff-dlg');
    if (!dlg.open) { dlg.showModal(); }
    this._$('#ff-desc').focus();
  };

  FleetFeedback.prototype.close = function () {
    var dlg = this._$('#ff-dlg');
    if (dlg && dlg.open) { dlg.close(); }
  };

  FleetFeedback.prototype._status = function (message, kind) {
    var el = this._$('#ff-status');
    el.textContent = message || '';
    if (kind) { el.setAttribute('data-kind', kind); } else { el.removeAttribute('data-kind'); }
  };

  FleetFeedback.prototype._clipboard = function (text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text);
    }
    return Promise.reject(new Error('clipboard unavailable'));
  };

  FleetFeedback.prototype.copy = function () {
    var self = this;
    this._clipboard(this.buildIssue().body).then(function () {
      self._status('The full report is on your clipboard.', 'ok');
    }, function () {
      self._status('Could not reach the clipboard — select the log preview and copy manually.', 'warn');
    });
  };

  FleetFeedback.prototype.submit = function () {
    var cfg = this.config(), self = this;
    if (!cfg.repo) { this._status('fleet-feedback: the repo attribute is missing.', 'warn'); return; }
    if (!this._$('#ff-desc').value.trim()) {
      this._status('Please describe the request first.', 'warn');
      this._$('#ff-desc').focus();
      return;
    }
    var issue = this.buildIssue();
    if (cfg.mode === 'postmessage') { return this._submitHost(issue); }
    if (cfg.mode === 'proxy') { return this._submitProxy(issue, cfg); }
    return this._submitUrl(issue, cfg);
  };

  /* url mode (default): no token anywhere. The reader submits the prefilled
     form under their own GitHub account. */
  FleetFeedback.prototype._submitUrl = function (issue, cfg) {
    var self = this;
    var built = Core.buildUrl(issue, { repo: cfg.repo });
    // No 'noopener' feature, so we get a real window handle and can tell a
    // blocked pop-up from an opened one; the opener link is severed by hand.
    var win = root.open(built.url, '_blank');
    if (win) { try { win.opener = null; } catch (e) { /* cross-origin */ } }

    if (!win) {
      this._clipboard(built.fullBody).then(function () {
        self._status('Your browser blocked the pop-up. The full report is on your clipboard — open a new issue and paste it in.', 'warn');
      }, function () {
        self._status('Your browser blocked the pop-up. Allow pop-ups for this site and try again.', 'warn');
      });
      return;
    }
    if (built.trimmed.length) {
      this._clipboard(built.fullBody).then(function () {
        self._status('Opened GitHub. The ' + built.trimmed.join(' and ') +
          ' section(s) were too long for the URL — the full report is on your clipboard; paste it over the prefilled body.', 'warn');
      }, function () {
        self._status('Opened GitHub. Some sections were trimmed to fit the URL.', 'warn');
      });
      return;
    }
    this._status('Opened a prefilled GitHub issue in a new tab.', 'ok');
    root.setTimeout(function () { self.close(); }, 1200);
  };

  /* proxy mode: an endpoint the host owns holds the token server-side. Falls
     back to the always-works url path rather than losing the report. */
  FleetFeedback.prototype._submitProxy = function (issue, cfg) {
    var self = this;
    this._status('Filing…');
    this._$('#ff-submit').disabled = true;
    root.fetch(cfg.endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: issue.title,
        body: issue.body,
        labels: issue.labels,
        assignees: issue.assignees,
        type: issue.type.id
      })
    }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (d) {
        if (!r.ok) { throw new Error((d && d.error) || ('HTTP ' + r.status)); }
        return d;
      });
    }).then(function (d) {
      var url = d.url || d.html_url;
      self._status(url ? 'Filed issue #' + (d.number || '') + ' — ' + url : 'Issue filed.', 'ok');
      root.setTimeout(function () { self.close(); }, 2500);
    }).catch(function (e) {
      self._status('Could not file directly (' + e.message + ') — opening a prefilled form instead…', 'warn');
      self._submitUrl(issue, cfg);
    }).then(function () {
      self._$('#ff-submit').disabled = false;
    });
  };

  /* postmessage mode: a sandboxed host (VS Code webview) has no window.open
     and no network of its own. Hand the issue to the extension host, which
     files it or opens the URL with vscode.env.openExternal. */
  FleetFeedback.prototype._submitHost = function (issue) {
    var api = root.__fleetFeedbackHost ||
      (typeof acquireVsCodeApi === 'function' ? acquireVsCodeApi() : null);
    if (!api || typeof api.postMessage !== 'function') {
      this._status('No host bridge available to file this issue.', 'warn');
      return;
    }
    api.postMessage({ type: 'fleet-feedback:file', issue: issue });
    this._status('Sent to the extension host.', 'ok');
    var self = this;
    root.setTimeout(function () { self.close(); }, 1200);
  };

  customElements.define('fleet-feedback', FleetFeedback);
})(typeof window !== 'undefined' ? window : globalThis);
