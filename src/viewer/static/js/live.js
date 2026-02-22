/* Bashcrawl Observatory — Live Monitor JS */
/* Connects to SSE endpoint /api/live/stream */

(function() {
    const eventFeed = document.getElementById('event-feed');
    const activeSessions = document.getElementById('active-sessions');
    const alerts = document.getElementById('alerts');
    const statusDot = document.getElementById('status-dot');
    const statusText = document.getElementById('status-text');

    if (!eventFeed) return;

    let eventSource = null;
    let reconnectTimer = null;
    const maxEvents = 200;
    const alertEvents = ['death', 'unlock', 'encounter'];
    let eventCount = 0;

    function connect() {
        if (eventSource) {
            eventSource.close();
        }

        eventSource = new EventSource('/api/live/stream');

        eventSource.onopen = function() {
            setStatus('connected', 'Connected — watching for events');
            if (reconnectTimer) {
                clearTimeout(reconnectTimer);
                reconnectTimer = null;
            }
        };

        eventSource.onmessage = function(e) {
            try {
                var data = JSON.parse(e.data);
                handleEvent(data);
            } catch (err) {
                console.warn('Failed to parse SSE event:', err);
            }
        };

        eventSource.addEventListener('heartbeat', function(e) {
            // Keep-alive, no action needed
        });

        eventSource.onerror = function() {
            setStatus('disconnected', 'Disconnected — reconnecting...');
            eventSource.close();
            // Reconnect after 5 seconds
            reconnectTimer = setTimeout(connect, 5000);
        };
    }

    function setStatus(state, text) {
        if (statusDot) {
            statusDot.className = 'status-dot ' + state;
        }
        if (statusText) {
            statusText.textContent = text;
        }
    }

    function handleEvent(data) {
        eventCount++;
        addEventToFeed(data);

        // Check for alert-worthy events
        if (data.event && alertEvents.includes(data.event)) {
            addAlert(data);
        }

        // Update active sessions periodically
        if (eventCount % 5 === 0) {
            refreshActiveSessions();
        }
    }

    function addEventToFeed(data) {
        // Clear empty state
        var empty = eventFeed.querySelector('.empty-state');
        if (empty) empty.remove();

        var item = document.createElement('div');
        item.className = 'event-feed-item';

        var time = data.ts ? new Date(data.ts * 1000).toLocaleTimeString() : '--:--:--';
        var event = data.event || 'unknown';
        var sid = data.sid ? data.sid.substring(0, 8) : '?';
        var room = data.room || '';

        item.innerHTML =
            '<span class="event-time">' + time + '</span>' +
            '<span class="event-type event-' + event + '">' + event + '</span>' +
            '<span class="event-sid">' + sid + '</span>' +
            (room ? '<span class="event-room">' + room + '</span>' : '');

        // Prepend (newest first)
        eventFeed.insertBefore(item, eventFeed.firstChild);

        // Limit total events displayed
        while (eventFeed.children.length > maxEvents) {
            eventFeed.removeChild(eventFeed.lastChild);
        }
    }

    function addAlert(data) {
        var empty = alerts.querySelector('.empty-state');
        if (empty) empty.remove();

        var severity = 'info';
        if (data.event === 'death') severity = 'death';
        else if (data.event === 'unlock') severity = 'unlock';
        else if (data.event === 'encounter') severity = 'treasure';

        var item = document.createElement('div');
        item.className = 'alert-item ' + severity;

        var time = data.ts ? new Date(data.ts * 1000).toLocaleTimeString() : '--:--';
        var msg = data.event;
        if (data.room) msg += ' in ' + data.room;
        if (data.cause) msg += ' — ' + data.cause;
        if (data.type) msg += ' (' + data.type + ')';

        item.innerHTML = '<strong>' + time + '</strong> ' + msg;

        alerts.insertBefore(item, alerts.firstChild);

        // Keep only last 50 alerts
        while (alerts.children.length > 50) {
            alerts.removeChild(alerts.lastChild);
        }
    }

    function refreshActiveSessions() {
        fetch('/api/live/active')
            .then(function(r) { return r.json(); })
            .then(function(data) {
                if (!data.active || data.active.length === 0) {
                    activeSessions.innerHTML = '<div class="empty-state"><p>No active sessions detected.</p></div>';
                    return;
                }
                activeSessions.innerHTML = '';
                data.active.forEach(function(session) {
                    var card = document.createElement('div');
                    card.className = 'session-card compact';
                    card.innerHTML =
                        '<div class="session-card-header">' +
                        '<span class="sid">' + (session.sid || '?').substring(0, 8) + '</span>' +
                        '<span class="badge badge-' + (session.mode || '') + '">' + (session.mode || '?') + '</span>' +
                        '</div>' +
                        '<div class="session-card-stats">' +
                        '<span>🏰 ' + (session.rooms || 0) + ' rooms</span>' +
                        '<span>📊 ' + (session.events || 0) + ' events</span>' +
                        '</div>';
                    activeSessions.appendChild(card);
                });
            })
            .catch(function() {
                // Silently fail — live data is best-effort
            });
    }

    // Start connection
    connect();

    // Cleanup on page unload
    window.addEventListener('beforeunload', function() {
        if (eventSource) eventSource.close();
        if (reconnectTimer) clearTimeout(reconnectTimer);
    });
})();
