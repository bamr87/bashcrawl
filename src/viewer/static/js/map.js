/* Bashcrawl Observatory — Dungeon Map JS */
/* Expects global `roomVisitCounts` from template */

(function() {
    const svg = document.getElementById('map-svg');
    const nodesGroup = document.getElementById('map-nodes');
    const edgesGroup = document.getElementById('map-edges');
    if (!svg || !nodesGroup || !edgesGroup) return;

    const visits = (typeof roomVisitCounts !== 'undefined') ? roomVisitCounts : {};

    // Room topology — positions and connections for the bashcrawl dungeon
    const rooms = [
        // Main path
        { id: 'entrance', label: 'entrance/', x: 450, y: 50, hidden: false },
        { id: 'cellar', label: 'cellar/', x: 450, y: 150, hidden: false },
        { id: 'armoury', label: 'armoury/', x: 450, y: 250, hidden: false },
        { id: 'chamber', label: 'chamber/', x: 450, y: 350, hidden: false },

        // Workshop (created by player)
        { id: 'workshop', label: 'workshop/', x: 600, y: 80, hidden: false },

        // Chapel branch
        { id: 'chapel', label: '.chapel/', x: 200, y: 100, hidden: true },
        { id: 'courtyard', label: 'courtyard/', x: 150, y: 200, hidden: true },
        { id: 'aviary', label: 'aviary/', x: 100, y: 300, hidden: true },
        { id: 'hall', label: 'hall/', x: 100, y: 400, hidden: true },

        // Vault branch
        { id: 'vault', label: '.vault/', x: 700, y: 100, hidden: true },
        { id: 'stronghold', label: 'stronghold/', x: 750, y: 200, hidden: true },

        // Scrap
        { id: 'scrap', label: '.scrap/', x: 300, y: 100, hidden: true },

        // Rift branch
        { id: 'rift', label: '.rift/', x: 700, y: 300, hidden: true },
        { id: 'arena', label: 'arena/', x: 650, y: 400, hidden: true },
        { id: 'spire', label: 'spire/', x: 750, y: 400, hidden: true },
    ];

    const edges = [
        // Main path
        { from: 'entrance', to: 'cellar', hidden: false },
        { from: 'cellar', to: 'armoury', hidden: false },
        { from: 'armoury', to: 'chamber', hidden: false },

        // Workshop
        { from: 'entrance', to: 'workshop', hidden: false },

        // Chapel branch
        { from: 'entrance', to: 'chapel', hidden: true },
        { from: 'chapel', to: 'courtyard', hidden: true },
        { from: 'courtyard', to: 'aviary', hidden: true },
        { from: 'aviary', to: 'hall', hidden: true },

        // Vault branch
        { from: 'entrance', to: 'vault', hidden: true },
        { from: 'vault', to: 'stronghold', hidden: true },

        // Scrap
        { from: 'entrance', to: 'scrap', hidden: true },

        // Rift branch
        { from: 'entrance', to: 'rift', hidden: true },
        { from: 'rift', to: 'arena', hidden: true },
        { from: 'rift', to: 'spire', hidden: true },
    ];

    const roomById = {};
    rooms.forEach(function(r) { roomById[r.id] = r; });

    // Compute heat levels (0-5) based on visit counts
    function getHeatLevel(roomId) {
        // Try various key formats that might appear in the data
        var count = 0;
        var keys = [roomId, roomId + '/', 'entrance/' + roomId, '.' + roomId];
        for (var i = 0; i < keys.length; i++) {
            if (visits[keys[i]]) { count = visits[keys[i]]; break; }
        }
        // Also search partial matches
        if (count === 0) {
            Object.keys(visits).forEach(function(key) {
                if (key.includes(roomId) || key.endsWith('/' + roomId)) {
                    count = Math.max(count, visits[key]);
                }
            });
        }
        if (count === 0) return 0;
        if (count <= 2) return 1;
        if (count <= 5) return 2;
        if (count <= 10) return 3;
        if (count <= 25) return 4;
        return 5;
    }

    function renderMap() {
        var showHeatmap = document.getElementById('show-heatmap').checked;
        var showHidden = document.getElementById('show-hidden').checked;

        edgesGroup.innerHTML = '';
        nodesGroup.innerHTML = '';

        // Draw edges
        edges.forEach(function(edge) {
            if (edge.hidden && !showHidden) return;
            var from = roomById[edge.from];
            var to = roomById[edge.to];
            if (!from || !to) return;

            var line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
            line.setAttribute('x1', from.x);
            line.setAttribute('y1', from.y);
            line.setAttribute('x2', to.x);
            line.setAttribute('y2', to.y);
            line.setAttribute('class', 'map-edge' + (edge.hidden ? ' hidden-edge' : ''));
            edgesGroup.appendChild(line);
        });

        // Draw room nodes
        rooms.forEach(function(room) {
            if (room.hidden && !showHidden) return;

            var heat = showHeatmap ? getHeatLevel(room.id) : 0;
            var g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
            g.setAttribute('class', 'room-node' +
                (room.hidden ? ' hidden-room' : '') +
                (heat > 0 ? ' visited heat-' + heat : ' heat-0'));
            g.setAttribute('transform', 'translate(' + room.x + ',' + room.y + ')');

            var rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
            rect.setAttribute('x', -55);
            rect.setAttribute('y', -18);
            rect.setAttribute('width', 110);
            rect.setAttribute('height', 36);
            g.appendChild(rect);

            var label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            label.setAttribute('class', 'room-label');
            label.setAttribute('y', heat > 0 ? -3 : 0);
            label.textContent = room.label;
            g.appendChild(label);

            if (heat > 0) {
                var visitText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
                visitText.setAttribute('class', 'room-visits');
                visitText.setAttribute('y', 10);

                var count = 0;
                Object.keys(visits).forEach(function(key) {
                    if (key.includes(room.id)) count = Math.max(count, visits[key]);
                });
                visitText.textContent = count + ' visits';
                g.appendChild(visitText);
            }

            // Tooltip on hover
            g.addEventListener('mouseenter', function(e) {
                showTooltip(room, e);
            });
            g.addEventListener('mouseleave', hideTooltip);

            nodesGroup.appendChild(g);
        });
    }

    // Tooltip
    var tooltip = document.createElement('div');
    tooltip.className = 'map-tooltip';
    document.getElementById('dungeon-map').appendChild(tooltip);

    function showTooltip(room, e) {
        var count = 0;
        Object.keys(visits).forEach(function(key) {
            if (key.includes(room.id)) count = Math.max(count, visits[key]);
        });

        tooltip.innerHTML =
            '<div class="tooltip-name">' + room.label + '</div>' +
            '<div class="tooltip-stats">' +
            '<span>Visits: ' + count + '</span>' +
            (room.hidden ? ' <span>(Hidden)</span>' : '') +
            '</div>';

        var rect = svg.getBoundingClientRect();
        tooltip.style.left = (e.clientX - rect.left + 15) + 'px';
        tooltip.style.top = (e.clientY - rect.top - 10) + 'px';
        tooltip.classList.add('visible');
    }

    function hideTooltip() {
        tooltip.classList.remove('visible');
    }

    // Public toggle handlers
    window.toggleHeatmap = function() { renderMap(); };
    window.toggleHidden = function() { renderMap(); };

    // Initial render
    renderMap();
})();
