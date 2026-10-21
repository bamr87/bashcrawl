/*!
 * fleet-feedback capture v0.2.0 — the early console/error ring buffer.
 * Source: bamr87/bamr87 templates/feedback/ (spec: specs/FEEDBACK.md, UPS-FB-04).
 *
 * Load this FIRST — before any other script, as high in <head> as you can get
 * it — so the errors that happen during page load are in the buffer by the time
 * a reader opens the feedback dialog. fleet-feedback.js installs the same
 * buffer if this file is absent, but by then the interesting failures have
 * already happened silently.
 *
 *   <script src="/assets/js/fleet-feedback-capture.js"></script>     <!-- Jekyll/Django -->
 *   <Script src="/fleet-feedback-capture.js" strategy="beforeInteractive" />  <!-- Next.js -->
 *
 * Small enough to inline verbatim into a <script> tag when a extra request
 * costs more than the bytes (the Jekyll adapter does exactly that).
 *
 * Contract — window.__fleetFeedback:
 *   logs        [{ t: ISO-8601, level: 'warn'|'error'|'net', msg: string }]
 *   limit       ring size (default 40)
 *   installed   true once the hooks are in place; a second load is a no-op
 *   version     kit version that installed it
 *   breadcrumb(level, message)  push a structured entry (fetch wrappers use this)
 *   snapshot()  a copy of the buffer, newest last
 *   clear()     empty it
 *
 * Privacy: in-memory only. Never persisted, never transmitted, never read until
 * the reader opens the dialog, previews the lines, and submits. Every entry is
 * redacted (bearer tokens, API keys, JWTs, email addresses) and truncated.
 */
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
