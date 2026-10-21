#!/usr/bin/env node
// =============================================================================
// verify/runner.mjs — execute USER SCENARIOS into EVIDENCE with Playwright
// =============================================================================
// kit: verify v0.1.0 (seeded from bamr87/bamr87 templates/verify/)
//
// Reads verify/verify.yml (where the app runs) and verify/scenarios/*.yml (what
// a user does), drives a real Chromium through each scenario at each viewport,
// and writes an evidence bundle per scenario:
//
//   <evidence_dir>/<scenario id>/<viewport>-<name>.png   screenshots
//   <evidence_dir>/<scenario id>/report.json             every step, timings,
//                                                        console errors, evals
//   <evidence_dir>/<scenario id>/README.md               scaffold (only if absent)
//   <evidence_dir>/report.json                           the aggregate
//
// The same YAML is what the verification agent reads as its acceptance script,
// so a scenario is both a regression test and an explanation of the feature.
//
// Dependencies (dev): @playwright/test, yaml — `npm i -D @playwright/test yaml`
// then `npx playwright install --with-deps chromium`. Nothing else.
//
// Usage:
//   node verify/runner.mjs [--base URL] [--config verify/verify.yml]
//                          [--scenarios DIR] [--out DIR] [--only <id>[,<id>]]
//                          [--feature <FEATURE-ID>] [--headed] [--no-fail]
//                          [--stamp --by agent|human|ci --run <url>] [--list]
//
//   --stamp   after a run, write `verified: {date, by, run}` into
//             features/features.yml for every feature whose scenarios ALL
//             passed (comments preserved). This is how "verified" reaches the
//             fleet features index without anyone hand-editing YAML.
//   --list    print scenario ids, titles, and feature ids (JSON) and exit.
//
// Exit code: 1 when any scenario failed (0 with --no-fail). Never throws on a
// single bad step — every step is recorded as ok/failed with its error so a
// bundle is always written; a report that says "step 3 failed: locator not
// visible" is the useful result, a crashed runner is not.
// =============================================================================
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from '@playwright/test';
import YAML from 'yaml';

// --------------------------------------------------------------------------- args
const argv = process.argv.slice(2);
const flag = (name, dflt) => {
  const i = argv.indexOf(name);
  if (i < 0) return dflt;
  const v = argv[i + 1];
  return v === undefined || v.startsWith('--') ? true : v;
};
const has = (name) => argv.includes(name);

const CONFIG_PATH = flag('--config', 'verify/verify.yml');
const cfg = fs.existsSync(CONFIG_PATH) ? YAML.parse(fs.readFileSync(CONFIG_PATH, 'utf8')) || {} : {};
const app = cfg.app || {};
const BASE = (flag('--base', process.env.BASE_URL || app.url || 'http://127.0.0.1:4000')).replace(/\/$/, '');
const SCEN_DIR = flag('--scenarios', cfg.scenarios || 'verify/scenarios');
const OUT_DIR = flag('--out', cfg.evidence_dir || 'test/evidence');
const FEATURES_PATH = cfg.features || 'features/features.yml';
const ONLY = flag('--only', '') ? String(flag('--only', '')).split(',').map((s) => s.trim()).filter(Boolean) : [];
const FEATURE = flag('--feature', '');
const HEADED = has('--headed');
const NO_FAIL = has('--no-fail');
const STAMP = has('--stamp');
const BY = flag('--by', process.env.GITHUB_ACTIONS ? 'ci' : 'human');
const RUN_URL = flag('--run', process.env.GITHUB_SERVER_URL && process.env.GITHUB_RUN_ID
  ? `${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}` : '');
const VIEWPORTS = Object.assign(
  { desktop: { width: 1280, height: 800 }, tablet: { width: 768, height: 1024 }, mobile: { width: 390, height: 844 } },
  cfg.viewports || {},
);

// --------------------------------------------------------------------------- scenarios
function loadScenarios() {
  if (!fs.existsSync(SCEN_DIR)) return [];
  return fs.readdirSync(SCEN_DIR)
    .filter((f) => /\.ya?ml$/.test(f))
    .sort()
    .map((f) => {
      const p = path.join(SCEN_DIR, f);
      let s;
      try { s = YAML.parse(fs.readFileSync(p, 'utf8')) || {}; } catch (e) { s = { id: f.replace(/\.ya?ml$/, ''), parse_error: String(e) }; }
      s.id = s.id || f.replace(/\.ya?ml$/, '');
      s.path = p;
      s.features = [].concat(s.feature || s.features || []).map(String);
      return s;
    })
    .filter((s) => (ONLY.length ? ONLY.includes(s.id) : true))
    .filter((s) => (FEATURE ? s.features.includes(String(FEATURE)) : true));
}

const scenarios = loadScenarios();
if (has('--list')) {
  console.log(JSON.stringify(scenarios.map((s) => ({ id: s.id, title: s.title || '', features: s.features, path: s.path })), null, 2));
  process.exit(0);
}
if (!scenarios.length) {
  console.log(`no scenarios in ${SCEN_DIR}${ONLY.length ? ` matching ${ONLY.join(',')}` : ''}`);
  process.exit(0);
}

// --------------------------------------------------------------------------- helpers
const now = () => new Date().toISOString();
const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const asViewport = (v) => (typeof v === 'string' ? { name: v, ...(VIEWPORTS[v] || VIEWPORTS.desktop) } : { name: v.name || `${v.width}x${v.height}`, ...v });
const firstLoc = (page, sel) => page.locator(String(sel)).first();

async function waitReady(url, timeoutS) {
  const deadline = Date.now() + timeoutS * 1000;
  let last = '';
  while (Date.now() < deadline) {
    try {
      const r = await fetch(url, { redirect: 'follow' });
      if (r.status < 500) return true;
      last = `HTTP ${r.status}`;
    } catch (e) { last = e.code || e.message; }
    await new Promise((r) => setTimeout(r, 1000));
  }
  console.error(`app not ready at ${url} after ${timeoutS}s (${last})`);
  return false;
}

// One step → { step, ok, ms, error? , value? }
async function runStep(page, step, ctx) {
  const [kind] = Object.keys(step);
  const arg = step[kind];
  const t0 = Date.now();
  const rec = { step: kind, arg, ok: true };
  try {
    switch (kind) {
      case 'goto': {
        const target = /^https?:/.test(arg) ? arg : BASE + (String(arg).startsWith('/') ? arg : `/${arg}`);
        const resp = await page.goto(target, { waitUntil: 'load' });
        ctx.lastStatus = resp ? resp.status() : null;
        await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
        break;
      }
      case 'click': await firstLoc(page, arg).click({ timeout: 10000 }); break;
      case 'fill': await firstLoc(page, arg.selector).fill(String(arg.value ?? ''), { timeout: 10000 }); break;
      case 'press': await page.keyboard.press(String(arg)); break;
      case 'select': await firstLoc(page, arg.selector).selectOption(String(arg.value), { timeout: 10000 }); break;
      case 'hover': await firstLoc(page, arg).hover({ timeout: 10000 }); break;
      case 'wait': {
        if (arg.ms) await page.waitForTimeout(Number(arg.ms));
        else if (arg.selector) await firstLoc(page, arg.selector).waitFor({ state: 'visible', timeout: Number(arg.timeout_ms || 15000) });
        else if (arg.url) await page.waitForURL((u) => u.href.includes(String(arg.url)), { timeout: Number(arg.timeout_ms || 15000) });
        break;
      }
      case 'expect': {
        if ('visible' in arg) await firstLoc(page, arg.visible).waitFor({ state: 'visible', timeout: 10000 });
        if ('hidden' in arg) await firstLoc(page, arg.hidden).waitFor({ state: 'hidden', timeout: 10000 });
        if ('text' in arg) {
          const body = await page.evaluate(() => document.body?.innerText || '');
          if (!body.includes(String(arg.text))) throw new Error(`page text does not contain ${JSON.stringify(arg.text)}`);
        }
        if ('title' in arg) {
          const t = await page.title();
          if (!t.includes(String(arg.title))) throw new Error(`title ${JSON.stringify(t)} does not contain ${JSON.stringify(arg.title)}`);
        }
        if ('url' in arg && !page.url().includes(String(arg.url))) throw new Error(`url ${page.url()} does not contain ${JSON.stringify(arg.url)}`);
        if ('count' in arg) {
          const n = await page.locator(String(arg.count.selector)).count();
          if (arg.count.min !== undefined && n < arg.count.min) throw new Error(`${arg.count.selector}: ${n} < min ${arg.count.min}`);
          if (arg.count.max !== undefined && n > arg.count.max) throw new Error(`${arg.count.selector}: ${n} > max ${arg.count.max}`);
          rec.value = n;
        }
        if (arg.no_console_errors && ctx.consoleErrors.length) throw new Error(`console errors: ${ctx.consoleErrors.slice(0, 3).join(' | ')}`);
        if (arg.no_horizontal_scroll) {
          const m = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
          rec.value = m;
          if (m.sw > m.cw + 1) throw new Error(`horizontal overflow: scrollWidth ${m.sw} > clientWidth ${m.cw}`);
        }
        if ('status' in arg && ctx.lastStatus !== Number(arg.status)) throw new Error(`status ${ctx.lastStatus} != ${arg.status}`);
        break;
      }
      case 'screenshot': {
        const file = path.join(ctx.outDir, `${ctx.viewport.name}-${slug(arg)}.png`);
        await page.screenshot({ path: file, fullPage: !!step.full_page });
        rec.file = path.relative(process.cwd(), file);
        ctx.screenshots.push(rec.file);
        break;
      }
      case 'eval': {
        const value = await page.evaluate(String(arg.script || arg));
        rec.value = value;
        if (arg.name) ctx.evals[arg.name] = value;
        break;
      }
      default: throw new Error(`unknown step kind ${JSON.stringify(kind)}`);
    }
  } catch (e) {
    rec.ok = false;
    rec.error = String(e.message || e).split('\n')[0].slice(0, 300);
  }
  rec.ms = Date.now() - t0;
  return rec;
}

async function runScenario(browser, s) {
  const outDir = path.join(OUT_DIR, slug(s.id));
  fs.mkdirSync(outDir, { recursive: true });
  const result = { id: s.id, title: s.title || '', features: s.features, path: s.path, started: now(), viewports: [], ok: true };
  if (s.parse_error) {
    result.ok = false; result.error = s.parse_error;
    return finish(result, outDir, s);
  }
  const ignore = [].concat(s.ignore_console || []).map((r) => new RegExp(r));
  for (const vp of (s.viewports || ['desktop']).map(asViewport)) {
    const context = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, deviceScaleFactor: 1 });
    const page = await context.newPage();
    const ctx = { viewport: vp, outDir, consoleErrors: [], screenshots: [], evals: {}, lastStatus: null };
    page.on('console', (m) => { if (m.type() === 'error' && !ignore.some((r) => r.test(m.text()))) ctx.consoleErrors.push(m.text().slice(0, 200)); });
    page.on('pageerror', (e) => { if (!ignore.some((r) => r.test(String(e)))) ctx.consoleErrors.push(`pageerror: ${String(e).slice(0, 200)}`); });
    const steps = [];
    let failed = false;
    for (const step of s.steps || []) {
      if (failed && !s.continue_on_failure) { steps.push({ step: Object.keys(step)[0], arg: step[Object.keys(step)[0]], ok: false, skipped: true }); continue; }
      const rec = await runStep(page, step, ctx);
      steps.push(rec);
      if (!rec.ok) {
        failed = true;
        // A failure screenshot is the single most useful artifact for the next reader.
        const file = path.join(outDir, `${vp.name}-FAILED-step${steps.length}.png`);
        await page.screenshot({ path: file, fullPage: false }).then(() => { rec.screenshot = path.relative(process.cwd(), file); ctx.screenshots.push(rec.screenshot); }).catch(() => {});
      }
    }
    result.viewports.push({ name: vp.name, width: vp.width, height: vp.height, ok: !failed, steps, console_errors: ctx.consoleErrors, screenshots: ctx.screenshots, evals: ctx.evals, final_url: page.url() });
    if (failed) result.ok = false;
    await context.close();
  }
  return finish(result, outDir, s);
}

function finish(result, outDir, s) {
  result.finished = now();
  result.base = BASE;
  fs.writeFileSync(path.join(outDir, 'report.json'), JSON.stringify(result, null, 2));
  const readme = path.join(outDir, 'README.md');
  if (!fs.existsSync(readme)) {
    fs.writeFileSync(readme, [
      `# ${s.title || s.id} — evidence`,
      '',
      `> **Feature:** ${s.features.map((f) => `\`${f}\``).join(', ') || '_none linked_'} · **Scenario:** \`${s.path}\` · **Generated by:** \`node verify/runner.mjs --only ${s.id}\` against \`${BASE}\` on ${result.finished.slice(0, 10)}`,
      '',
      s.description ? s.description : 'TODO: one paragraph — what the user can do and what these images prove.',
      '',
      '## What each image shows',
      '',
      '| Image | Viewport | What to look at |',
      '| --- | --- | --- |',
      ...result.viewports.flatMap((v) => v.screenshots.map((f) => `| \`${path.basename(f)}\` | ${v.width}×${v.height} | TODO |`)),
      '',
      'Raw data: [`report.json`](report.json).',
      '',
    ].join('\n'));
  }
  const mark = result.ok ? 'PASS' : 'FAIL';
  console.log(`${mark}  ${s.id}${s.title ? ` — ${s.title}` : ''}  (${result.viewports.length} viewport${result.viewports.length === 1 ? '' : 's'}) → ${outDir}/`);
  for (const v of result.viewports) for (const st of v.steps) if (!st.ok && !st.skipped) console.log(`       ✗ ${v.name}: ${st.step} ${JSON.stringify(st.arg)} — ${st.error}`);
  return result;
}

// Stamp `verified:` onto features whose scenarios all passed, preserving
// comments (yaml's Document API), so the fleet index can show WHEN and BY WHOM.
function stampFeatures(results) {
  if (!fs.existsSync(FEATURES_PATH)) { console.log(`--stamp: ${FEATURES_PATH} not found`); return; }
  const byFeature = new Map();
  for (const r of results) for (const f of r.features) byFeature.set(f, (byFeature.get(f) ?? true) && r.ok);
  const doc = YAML.parseDocument(fs.readFileSync(FEATURES_PATH, 'utf8'));
  if (doc.errors.length) {
    // Never rewrite a file the parser could not round-trip: report and skip.
    console.log(`--stamp: ${FEATURES_PATH} has ${doc.errors.length} YAML error(s); not stamping:`);
    for (const e of doc.errors) console.log(`  ${e.code} ${String(e.message).split('\n')[0]}`);
    return;
  }
  const feats = doc.get('features');
  if (!feats || !feats.items) return;
  let n = 0;
  for (const item of feats.items) {
    const id = String(item.get('id'));
    if (!byFeature.has(id) || !byFeature.get(id)) continue;
    const v = doc.createNode({ date: now().slice(0, 10), by: BY, ...(RUN_URL ? { run: RUN_URL } : {}) });
    item.set('verified', v);
    n += 1;
  }
  fs.writeFileSync(FEATURES_PATH, doc.toString({ lineWidth: 0 }));
  console.log(`--stamp: verified ${n} feature(s) in ${FEATURES_PATH} (by ${BY})`);
}

// --------------------------------------------------------------------------- main
const readyUrl = BASE + (String(app.ready || '/').startsWith('/') ? String(app.ready || '/') : `/${app.ready}`);
if (!(await waitReady(readyUrl, Number(app.timeout_s || 120)))) process.exit(NO_FAIL ? 0 : 1);

let browser;
try {
  browser = await chromium.launch({ headless: !HEADED });
} catch (e) {
  // A missing browser is the single most common first-run failure; say what
  // to do instead of dumping a stack trace.
  console.error(`cannot launch Chromium: ${String(e.message || e).split('\n')[0]}`);
  console.error('run: npx playwright install --with-deps chromium');
  process.exit(NO_FAIL ? 0 : 1);
}
const results = [];
try {
  for (const s of scenarios) results.push(await runScenario(browser, s));
} finally {
  await browser.close();
}
fs.mkdirSync(OUT_DIR, { recursive: true });
// A partial run (--only / --feature) merges into the existing aggregate by
// scenario id, so re-running one scenario never erases the others' results.
const aggPath = path.join(OUT_DIR, 'report.json');
let previous = [];
if ((ONLY.length || FEATURE) && fs.existsSync(aggPath)) {
  try { previous = (JSON.parse(fs.readFileSync(aggPath, 'utf8')).scenarios || []).filter((s) => !results.some((r) => r.id === s.id)); } catch { previous = []; }
}
const rows = [...previous, ...results.map((r) => ({ id: r.id, title: r.title, features: r.features, ok: r.ok, dir: path.join(OUT_DIR, slug(r.id)), screenshots: r.viewports.flatMap((v) => v.screenshots) }))]
  .sort((a, b) => a.id.localeCompare(b.id));
const aggregate = {
  schema: 'verify-report/v1', base: BASE, generated: now(), by: BY, run: RUN_URL || null,
  total: rows.length, passed: rows.filter((r) => r.ok).length, failed: rows.filter((r) => !r.ok).length,
  scenarios: rows,
};
fs.writeFileSync(aggPath, JSON.stringify(aggregate, null, 2));
console.log(`\n${aggregate.passed}/${aggregate.total} scenario(s) passed → ${aggPath}`);
if (STAMP) stampFeatures(results);
process.exit(results.some((r) => !r.ok) && !NO_FAIL ? 1 : 0);
