/* Bashcrawl Observatory — AI Agent Live View
 * Connects to /api/live/agent/stream (SSE) and renders a terminal-style
 * view of the running agent session.
 */
(function () {
  'use strict';

  // ── DOM refs ──────────────────────────────────────────────────────────────
  const body         = document.getElementById('terminal-body');
  const title        = document.getElementById('terminal-title');
  const indicator    = document.getElementById('agent-indicator');
  const statusText   = document.getElementById('agent-status-text');
  const turnBadge    = document.getElementById('turn-badge');
  const autoScrollBtn = document.getElementById('auto-scroll-btn');

  // Side panel
  const sActive   = document.getElementById('s-active');
  const sTest     = document.getElementById('s-test');
  const sTurn     = document.getElementById('s-turn');
  const sElapsed  = document.getElementById('s-elapsed');
  const sExit     = document.getElementById('s-exit');
  const gLocation = document.getElementById('g-location');
  const gInventory= document.getElementById('g-inventory');
  const gHp       = document.getElementById('g-hp');
  const gHpBar    = document.getElementById('g-hp-bar');
  const gRooms    = document.getElementById('g-rooms');
  const tokCalls  = document.getElementById('tok-calls');
  const tokIn     = document.getElementById('tok-in');
  const tokOut    = document.getElementById('tok-out');
  const fbCard    = document.getElementById('feedback-card');
  const fbRating  = document.getElementById('fb-rating');
  const fbIssues  = document.getElementById('fb-issues');
  const fbSuggestions = document.getElementById('fb-suggestions');

  // ── State ─────────────────────────────────────────────────────────────────
  let autoScroll   = true;
  let sessionStart = 0;
  let maxTurns     = 0;
  let apiCalls     = 0;
  let tokenIn      = 0;
  let tokenOut     = 0;
  let roomsVisited = [];
  let elapsedTimer = null;
  let es           = null;

  // ── Helpers ───────────────────────────────────────────────────────────────
  function esc(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  function fmt(n) {
    if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
    if (n >= 1000)    return (n / 1000).toFixed(1) + 'k';
    return String(n);
  }

  function appendRow(cls, html) {
    // Remove the blinking cursor placeholder
    var cursor = body.querySelector('.t-cursor');
    if (cursor) cursor.parentElement.remove();

    var row = document.createElement('div');
    row.className = 't-row';
    row.innerHTML = '<span class="' + cls + '">' + html + '</span>';
    body.appendChild(row);

    // Re-add cursor at bottom
    var cursorRow = document.createElement('div');
    cursorRow.className = 't-row';
    cursorRow.innerHTML = '<span class="t-cursor"></span>';
    body.appendChild(cursorRow);

    if (autoScroll) body.scrollTop = body.scrollHeight;
  }

  function setStatus(state, text) {
    indicator.className = 'status-indicator ' + state;
    statusText.textContent = text;
  }

  function setActive(yes) {
    sActive.textContent = yes ? 'Running' : 'Idle';
    sActive.className = 'info-value ' + (yes ? 'active' : 'idle');
  }

  function updateRooms(rooms) {
    if (!rooms || !rooms.length) return;
    roomsVisited = rooms;
    var current = rooms[rooms.length - 1];
    gRooms.innerHTML = rooms.map(function (r) {
      return '<span class="room-pill' + (r === current ? ' current' : '') + '">' + esc(r) + '</span>';
    }).join('');
  }

  function startElapsedTimer() {
    if (elapsedTimer) clearInterval(elapsedTimer);
    elapsedTimer = setInterval(function () {
      if (!sessionStart) return;
      var secs = Math.floor((Date.now() / 1000) - sessionStart);
      sElapsed.textContent = secs + 's';
    }, 1000);
  }

  // ── Event handlers ────────────────────────────────────────────────────────
  function handle(ev) {
    var t = ev.type;

    if (t === 'heartbeat') {
      // silent keep-alive
      return;
    }

    if (t === 'session_start') {
      // Clear terminal
      body.innerHTML = '';
      fbCard.classList.remove('visible');
      apiCalls = tokenIn = tokenOut = 0;
      roomsVisited = [];
      tokCalls.textContent = '0';
      tokIn.textContent = '0';
      tokOut.textContent = '0';
      gRooms.innerHTML = '<span class="info-label" style="font-size:0.8rem">None yet</span>';
      sExit.textContent = '—';

      sessionStart = ev.ts || (Date.now() / 1000);
      maxTurns = ev.max_turns || 0;
      title.textContent = 'bash — ' + (ev.test || 'AI Agent Session');

      var goalText = ev.goal ? ev.goal.substring(0, 80) + (ev.goal.length > 80 ? '…' : '') : '';
      appendRow('t-meta', '▶ Session started · max turns: ' + (ev.max_turns || '?') + ' · max time: ' + (ev.max_elapsed || '?') + 's');
      if (goalText) appendRow('t-meta', '🎯 Goal: ' + esc(goalText));

      sTest.textContent = ev.test || '—';
      sTurn.textContent = '0 / ' + (ev.max_turns || '?');
      setActive(true);
      setStatus('active', 'Agent running');
      startElapsedTimer();
      return;
    }

    if (t === 'command') {
      var turn = ev.turn !== undefined ? ev.turn : '?';
      var loc  = ev.location || '/entrance';

      // Prompt line
      var promptHtml =
        '<span class="t-prompt">[' + esc(loc) + ']</span> ' +
        '<span class="t-cmd">$ ' + esc(ev.cmd || '') + '</span>';
      appendRow('', promptHtml);

      // Output
      if (ev.output && ev.output.trim()) {
        var outLines = ev.output.trim().split('\n').slice(0, 12);  // cap at 12 lines
        outLines.forEach(function (line) {
          appendRow('t-output', esc(line));
        });
        if (ev.output.trim().split('\n').length > 12) {
          appendRow('t-meta', '  … (output truncated)');
        }
      }

      // Update side panel
      sTurn.textContent = (turn + 1) + ' / ' + (maxTurns || '?');
      turnBadge.textContent = 'Turn ' + (turn + 1);
      gLocation.textContent = loc;
      gInventory.textContent = ev.inventory || 'empty';

      if (ev.hp !== undefined && ev.hp >= 0) {
        gHp.textContent = ev.hp;
        var pct = Math.min(100, Math.max(0, ev.hp));
        gHpBar.style.width = pct + '%';
      }

      // Track rooms
      if (loc) {
        var short = loc.replace(/^\/?entrance\/?/, '') || 'entrance';
        if (!roomsVisited.includes(short)) {
          roomsVisited.push(short);
          updateRooms(roomsVisited);
        }
      }
      return;
    }

    if (t === 'api_call') {
      apiCalls++;
      tokenIn  += (ev.tokens_in  || 0);
      tokenOut += (ev.tokens_out || 0);
      tokCalls.textContent = String(apiCalls);
      tokIn.textContent    = fmt(tokenIn);
      tokOut.textContent   = fmt(tokenOut);
      appendRow('t-api', '⚡ API call #' + apiCalls +
        (ev.tokens_in  ? ' · ' + ev.tokens_in  + ' in' : '') +
        (ev.tokens_out ? ' · ' + ev.tokens_out + ' out' : ''));
      return;
    }

    if (t === 'rate_limit') {
      appendRow('t-rl', '⏳ Rate limit — sleeping ' + (ev.sleep || 0).toFixed(1) + 's (cap: ' + (ev.rpm_cap || '?') + ' RPM)');
      setStatus('waiting', 'Rate limited — waiting ' + (ev.sleep || 0).toFixed(1) + 's…');
      setTimeout(function () {
        setStatus('active', 'Agent running');
      }, (ev.sleep || 1) * 1000);
      return;
    }

    if (t === 'session_end') {
      if (elapsedTimer) clearInterval(elapsedTimer);
      appendRow('t-end', '■ Session ended · ' + (ev.exit_reason || 'unknown') +
        ' · ' + (ev.total_turns || 0) + ' turns · ' + (ev.elapsed || 0).toFixed(1) + 's');

      setActive(false);
      sExit.textContent    = ev.exit_reason || '—';
      sElapsed.textContent = (ev.elapsed || 0).toFixed(1) + 's';
      if (ev.rooms_visited) updateRooms(ev.rooms_visited);
      if (ev.final_inventory) gInventory.textContent = ev.final_inventory;
      if (ev.final_hp !== undefined) {
        gHp.textContent = ev.final_hp;
        gHpBar.style.width = Math.min(100, ev.final_hp) + '%';
      }
      setStatus('idle', 'Session finished — ' + (ev.exit_reason || ''));
      return;
    }

    if (t === 'feedback') {
      appendRow('t-fb', '📋 Agent rating: ' + (ev.rating || '?') + '/10');
      if (ev.issues)      appendRow('t-fb', '🐛 Issues: ' + esc(ev.issues.substring(0, 200)));
      if (ev.suggestions) appendRow('t-fb', '💡 Suggestions: ' + esc(ev.suggestions.substring(0, 200)));

      fbCard.classList.add('visible');
      fbRating.textContent = (ev.rating || '?') + '/10';
      if (ev.issues)      fbIssues.textContent = ev.issues;
      if (ev.suggestions) fbSuggestions.textContent = ev.suggestions;
      return;
    }

    // Unknown event type — show as meta
    appendRow('t-meta', '· ' + esc(JSON.stringify(ev).substring(0, 120)));
  }

  // ── SSE connection ────────────────────────────────────────────────────────
  function connect() {
    if (es) es.close();
    setStatus('waiting', 'Connecting…');

    // First, replay existing events (snapshot)
    fetch('/api/live/agent/events?limit=500')
      .then(function (r) { return r.json(); })
      .then(function (data) {
        (data.events || []).forEach(handle);
      })
      .catch(function () {})
      .finally(function () {
        // Then open the tail stream
        es = new EventSource('/api/live/agent/stream');

        es.onopen = function () {
          setStatus('idle', 'Connected — watching for agent events');
        };

        es.onmessage = function (e) {
          try { handle(JSON.parse(e.data)); } catch (_) {}
        };

        es.onerror = function () {
          setStatus('waiting', 'Reconnecting…');
          es.close();
          setTimeout(connect, 4000);
        };
      });
  }

  // ── Controls ──────────────────────────────────────────────────────────────
  window.scrollToBottom = function () {
    body.scrollTop = body.scrollHeight;
  };

  window.toggleAutoScroll = function () {
    autoScroll = !autoScroll;
    autoScrollBtn.textContent = 'Auto-scroll: ' + (autoScroll ? 'ON' : 'OFF');
    autoScrollBtn.classList.toggle('btn-secondary', !autoScroll);
  };

  // Start
  connect();

  window.addEventListener('beforeunload', function () {
    if (es) es.close();
    if (elapsedTimer) clearInterval(elapsedTimer);
  });
})();
