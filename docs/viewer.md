# Bashcrawl Observatory — Log & Screenshot Viewer

The **Bashcrawl Observatory** is a self-contained Flask web app that lets you
browse session logs, view screenshots, explore cross-session analytics, read
feedback reports, and watch live game sessions — all through a browser.

> **Location:** `src/viewer/`  
> **Requires:** Python 3.10+, Flask 3.x (see [Installation](#installation))

---

## Table of Contents

1. [Installation](#installation)
2. [Launching the Viewer](#launching-the-viewer)
3. [Pages & Features](#pages--features)
   - [Dashboard (/)](#dashboard-)
   - [Session Browser (/sessions)](#session-browser-sessions)
   - [Screenshot Gallery (/screenshots)](#screenshot-gallery-screenshots)
   - [Analytics Dashboard (/analytics)](#analytics-dashboard-analytics)
   - [Feedback Reports (/feedback)](#feedback-reports-feedback)
   - [Dungeon Map (/map)](#dungeon-map-map)
   - [Live Monitor (/live)](#live-monitor-live)
4. [JSON API](#json-api)
5. [Configuration](#configuration)
6. [Troubleshooting](#troubleshooting)

---

## Installation

The viewer's Python dependencies are separate from the main game. Install them
once into the project virtualenv:

```bash
# From the repo root
pip install -r src/viewer/requirements.txt
```

Dependencies installed:

| Package | Purpose |
|---------|---------|
| `flask>=3.0` | Web framework |
| `markdown>=3.5` | Render feedback reports to HTML |
| `watchdog>=4.0` | Filesystem monitoring for live updates |

---

## Launching the Viewer

### Quickstart

```bash
python3 -m src.viewer
```

Opens at **http://127.0.0.1:5000/**. The game root is auto-detected from the
repo directory (the folder containing `entrance/`).

### Options

```
python3 -m src.viewer [OPTIONS]

Options:
  --port PORT       Port to listen on (default: 5000)
  --host HOST       Host to bind to (default: 127.0.0.1)
  --game-root PATH  Path to bashcrawl game root (default: auto-detect)
  --debug           Enable Flask debug mode (auto-reload on code changes)
```

### Examples

```bash
# Default — auto-detect game root, port 5000
python3 -m src.viewer

# Custom port (e.g. if 5000 is taken)
python3 -m src.viewer --port 8080

# Expose to LAN (e.g. to view from another machine)
python3 -m src.viewer --host 0.0.0.0 --port 5000

# Development mode with auto-reload
python3 -m src.viewer --debug

# Point to a non-standard game root
python3 -m src.viewer --game-root /path/to/bashcrawl
```

---

## Pages & Features

### Dashboard (`/`)

The landing page shows a high-level summary of all data in the `logs/`
directory:

- Total session count, event count, screenshot session count, and feedback
  report count
- Aggregate analytics (rooms visited, encounters, deaths, items collected)
- A table of the 10 most recent sessions with quick stats

Use this page as a home base to orient yourself before drilling into specific
sessions or analytics.

---

### Session Browser (`/sessions`)

Searchable, sortable paginated list of every recorded game session.

#### Filtering

| Filter | How to use |
|--------|-----------|
| **Mode** | Dropdown — filter by `interactive`, `launcher`, `integration_test`, `ai_test`, or `all` |
| **Has Screenshots** | Checkbox — show only sessions that have linked screenshot directories |
| **Sort by** | Date, duration, event count, or room count |
| **Order** | Ascending or descending |

Pagination shows 25 sessions per page. Navigate with **Prev / Next** buttons or
direct page links.

#### Session Cards

Each card displays:

- Session ID (SID) — click to open the detail view
- Date and time (`YYYY-MM-DD HH:MM`)
- Mode badge (`launcher`, `interactive`, `ai_test`, `integration_test`)
- Duration
- Room count, encounter count, death count, screenshot count
- Items collected

#### Session Detail (`/sessions/<sid>`)

Click any session card to open its detail view:

| Section | Description |
|---------|-------------|
| **Header** | SID, date, mode, shell, OS, total duration |
| **Event Timeline** | Color-coded vertical timeline. Click any node to expand full JSON. Colors: blue = room enter, green = encounter, red = death, yellow = help, purple = screenshot |
| **Room Path** | Horizontal breadcrumb showing rooms visited in sequence |
| **Inventory Tracker** | Items added at each event |
| **HP Graph** | Sparkline of health changes over the session |
| **Screenshots Panel** | Thumbnail strip of any linked screenshots; click to open gallery |
| **Raw JSONL** | Collapsible raw log with syntax highlighting |
| **Feedback Link** | Link to the feedback report for this session if one exists |

---

### Screenshot Gallery (`/screenshots`)

Browse SVG screenshots captured by the agent or test framework.

#### Index View (`/screenshots`)

Grid of screenshot session directories (one per test run or agent session).
Each card shows:

- Test/session name
- Date and time
- Screenshot count and total size
- Thumbnail of the first screenshot

Filter by test name using the search box. Sort by date, screenshot count, or
total size.

#### Session Gallery (`/screenshots/<dir>`)

Filmstrip + main viewer for a single screenshot session:

| Control | Action |
|---------|--------|
| **Filmstrip** | Horizontal scrollable strip; click any thumbnail to jump to it |
| **Arrow keys** | Navigate previous / next screenshot |
| `◀ Prev` / `Next ▶` | Button navigation |
| **Slideshow** | Auto-advance with 1–5 second interval |
| **Metadata panel** | Shows trigger (`agent_auto`, `explicit`, `milestone`), command, room, timestamp, and file size for the selected screenshot |
| **Linked Session** | If the screenshot directory is linked to a JSONL session, a button navigates to that session's detail view |
| **Download** | Download the selected SVG; ZIP download of all screenshots in the session |

---

### Analytics Dashboard (`/analytics`)

Aggregate statistics across all sessions, visualized with interactive
[Chart.js](https://www.chartjs.org/) charts.

| Panel | Chart type | Data |
|-------|-----------|------|
| Session Volume | Bar | Sessions per day |
| Mode Distribution | Donut | Sessions broken down by mode |
| Top Rooms | Horizontal bar | 10 most-visited rooms |
| Room Heatmap | Dungeon map overlay | Visit frequency as color intensity |
| Encounter Outcomes | Stacked bar | Win/lose/flee per encounter type |
| Death Causes | Pie | Deaths by cause |
| Items Collected | Icon grid | Collection frequency per item |
| Session Duration | Histogram | Distribution of session lengths |
| Completion Funnel | Funnel | % of sessions reaching each zone (entrance → cellar → armoury → chamber) |
| Stuck Points | Table | Rooms with high revisit + help-request counts |
| Commands Used | Bar | Most frequent commands across all sessions |
| Progression Over Time | Line | Average rooms per session trending day-by-day |

**Interactions:**

- The global **date range** filter at the top affects all panels simultaneously.
- Click a room bar to filter the session list to sessions that visited that room.
- Click a chart segment to drill down to matching sessions.

Analytics are cached for 60 seconds. Use the **Refresh** button to recompute
immediately.

---

### Feedback Reports (`/feedback`)

Human-readable Markdown reports generated by AI or test runs.

#### List View (`/feedback`)

Cards showing report date, session SID, and key metrics (rooms, encounters,
deaths). Sort by date or death count.

#### Detail View (`/feedback/<sid>`)

- **Rendered Markdown** — full report displayed as HTML
- **Metrics sidebar** — key stats pulled from the report in visual cards
- **Cross-links** — buttons to view the source session log and any linked
  screenshots

---

### Dungeon Map (`/map`)

Interactive SVG visualization of the entire dungeon topology.

| Element | Description |
|---------|-------------|
| **Room nodes** | Clickable circles. Size proportional to visit count across all sessions |
| **Edges** | Lines connecting rooms. Thickness proportional to traversal count |
| **Hidden rooms** | Shown with dashed border and lock icon; filled when unlocked |
| **Heatmap overlay** | Toggle color intensity based on visit frequency |
| **Room tooltip** | Hover to see visit count, avg time spent, commands taught, encounters |
| **Session path** | Select a session from the dropdown to animate the player's path through the dungeon |
| **Legend** | Color coding for room types |

---

### Live Monitor (`/live`)

Real-time view of active sessions using **Server-Sent Events (SSE)**.

| Element | Description |
|---------|-------------|
| **Active sessions** | Sessions with events in the last 60 seconds |
| **Event feed** | Scrolling color-coded log that updates automatically |
| **Live map** | Dungeon map with animated player position |
| **Screenshot auto-display** | When a screenshot event arrives, the new SVG appears automatically |
| **Alert banners** | Flash notification on notable events: death, treasure collected, room unlocked |

---

### AI Agent Live View (`/live/agent`)

A dedicated page that streams the output of an AI agent test session in real
time. The underlying data source is `logs/live_agent.jsonl`, a file that the
test suite truncates at the start of each run and then appends to as events
arrive. The browser connects via SSE and renders each event as it lands.

#### Workflow

```
Terminal A                         Browser
─────────────────────────          ──────────────────────────────
python3 -m src.viewer              http://127.0.0.1:5000/live/agent
                                     ← SSE connection open

Terminal B
─────────────────────────
cd test
pytest -m ai -s             →→→  events stream to browser
```

1. **Start the viewer** in one terminal: `python3 -m src.viewer`
2. **Open** http://127.0.0.1:5000/live/agent in your browser.
3. **Run the AI tests** in a second terminal: `cd test && pytest -m ai -s`
4. The page updates automatically — no manual refresh needed.

#### What the page shows

| Element | Description |
|---------|-------------|
| **Session header** | Test name, goal, max turns, max elapsed time |
| **Event feed** | Color-coded stream: commands (white), AI API calls (blue), rate-limit pauses (yellow), session end (green/red) |
| **Current state panel** | Agent's current room, inventory, HP — updated after every command |
| **Turn counter** | Running count of commands executed vs the max |
| **Elapsed timer** | Wall-clock time since session start |
| **Status badge** | `ACTIVE` (green) while running → `COMPLETE` or `TIMED OUT` at end |

#### Event types in the feed

| `type` field | Meaning |
|--------------|---------|
| `session_start` | New AI test run beginning — resets the feed |
| `command` | Agent executed a shell command; shows command + truncated output |
| `api_call` | Claude API call made; shows model, token counts |
| `rate_limit` | Agent sleeping to stay within API rate limits |
| `session_end` | Run finished; shows exit reason, rooms visited, final inventory |
| `feedback` | AI self-evaluation of the session (rating, issues, suggestions) |
| `heartbeat` | Viewer keep-alive ping (every 10 s); not displayed in the feed |

#### Viewing results after the test finishes

Once a test completes, its data is available in the standard viewer pages:

- **Sessions** — http://127.0.0.1:5000/sessions — filter by mode `ai_test`.
  Click the session card for the full event timeline, room path, and inventory
  tracker.
- **Screenshots** — http://127.0.0.1:5000/screenshots — any SVG screenshots
  captured by the agent appear as a filmstrip gallery linked to the session.
- **Feedback** — http://127.0.0.1:5000/feedback — the AI's self-evaluation
  report (if the test script emits a `feedback` event) is rendered as
  formatted Markdown.
- **Analytics** — http://127.0.0.1:5000/analytics — AI sessions are included
  in the cross-session aggregates. Filter by mode to isolate them.

---

## JSON API

All endpoints are under `/api/`. Responses are JSON.

### Sessions

| Method | Endpoint | Query params | Description |
|--------|----------|-------------|-------------|
| GET | `/api/sessions` | `mode`, `has_screenshots`, `min_events`, `sort`, `order`, `page`, `per_page` | Paginated session list |
| GET | `/api/sessions/stats` | — | Quick stats (total count, mode breakdown) |
| GET | `/api/sessions/<sid>` | — | Full session detail including all events |

### Screenshots

| Method | Endpoint | Query params | Description |
|--------|----------|-------------|-------------|
| GET | `/api/screenshots` | `test_name`, `sort`, `page`, `per_page` | Paginated screenshot session list |
| GET | `/api/screenshots/<dir_name>` | — | Manifest + metadata for one screenshot session |

### Analytics

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/analytics` | Full analytics summary |
| GET | `/api/analytics/rooms` | Room visit data for heatmap |
| GET | `/api/analytics/encounters` | Encounter breakdown |
| GET | `/api/analytics/timeline` | Sessions-per-day time series |
| GET | `/api/analytics/funnel` | Completion funnel data |

### Feedback

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/feedback` | List all feedback reports |
| GET | `/api/feedback/<sid>` | Report content (HTML + metrics) |

### Live (general)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/live/stream` | SSE stream of real-time session events |
| GET | `/api/live/active` | Sessions with events in the last 60 seconds |

### Live (AI agent)

| Method | Endpoint | Query params | Description |
|--------|----------|-------------|-------------|
| GET | `/api/live/agent/stream` | — | SSE stream tailing `logs/live_agent.jsonl` |
| GET | `/api/live/agent/status` | — | Latest session metadata + active flag |
| GET | `/api/live/agent/events` | `limit`, `skip` | Last N events from the live log |

---

## Configuration

All paths are derived automatically from `--game-root` (or the auto-detected
repo root):

| Path | Purpose |
|------|---------|
| `<game-root>/logs/sessions/` | JSONL session files |
| `<game-root>/logs/screenshots/` | Screenshot directories |
| `<game-root>/logs/feedback/` | Markdown feedback reports |

Session data is loaded on startup and cached in memory. At current scale (~250
sessions, ~2 K events, ~60 MB total) the startup load takes under one second.
New JSONL files are detected automatically; existing sessions are re-parsed
when their file modification time changes.

---

## Troubleshooting

**`Error: Could not auto-detect game root`**  
Run from within the repo, or pass `--game-root /path/to/bashcrawl`.

**Port already in use**  
Use `--port 8080` (or any free port).

**`ModuleNotFoundError: flask`**  
Run `pip install -r src/viewer/requirements.txt` first.

**Screenshots not showing**  
SVGs are served directly from `logs/screenshots/`. Ensure the directory exists
and contains subdirectories with `.svg` files.

**Analytics charts blank**  
Chart.js is loaded from CDN — an internet connection is required the first
time the analytics page loads. After that, your browser caches the library.

**Stale session data**  
Click the **Refresh** button on the analytics or session list pages, or
restart the viewer to force a full reload.
