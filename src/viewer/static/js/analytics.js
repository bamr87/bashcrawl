/* Bashcrawl Observatory — Analytics Charts JS */
/* Requires Chart.js 4.x loaded before this script */
/* Expects global `analyticsData` from template */

(function() {
    if (typeof analyticsData === 'undefined' || typeof Chart === 'undefined') return;

    const gold = '#d4a574';
    const blue = '#60a5fa';
    const green = '#4ade80';
    const red = '#f87171';
    const yellow = '#fbbf24';
    const purple = '#a78bfa';
    const orange = '#fb923c';

    // Shared chart defaults for dark theme
    Chart.defaults.color = '#999';
    Chart.defaults.borderColor = 'rgba(255,255,255,0.08)';
    Chart.defaults.font.family = "'JetBrains Mono', 'Fira Code', monospace";
    Chart.defaults.font.size = 11;
    Chart.defaults.plugins.legend.display = false;

    // 1. Sessions by Date (line chart)
    const dates = Object.keys(analyticsData.sessions_by_date).sort();
    const dateCounts = dates.map(function(d) { return analyticsData.sessions_by_date[d]; });

    new Chart(document.getElementById('chart-timeline'), {
        type: 'line',
        data: {
            labels: dates,
            datasets: [{
                label: 'Sessions',
                data: dateCounts,
                borderColor: gold,
                backgroundColor: 'rgba(212,165,116,0.1)',
                fill: true,
                tension: 0.3,
                pointRadius: 2,
                pointHoverRadius: 5
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            scales: {
                y: { beginAtZero: true, ticks: { stepSize: 1 } }
            }
        }
    });

    // 2. Sessions by Mode (doughnut)
    const modes = Object.keys(analyticsData.sessions_by_mode);
    const modeCounts = modes.map(function(m) { return analyticsData.sessions_by_mode[m]; });
    const modeColors = [gold, blue, green, purple, orange, red, yellow];

    new Chart(document.getElementById('chart-modes'), {
        type: 'doughnut',
        data: {
            labels: modes,
            datasets: [{
                data: modeCounts,
                backgroundColor: modeColors.slice(0, modes.length),
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: { display: true, position: 'right' }
            }
        }
    });

    // 3. Top Rooms (horizontal bar)
    var topRooms = analyticsData.top_rooms || [];
    var roomLabels = topRooms.map(function(r) { return r.room; });
    var roomCounts = topRooms.map(function(r) { return r.count; });

    new Chart(document.getElementById('chart-rooms'), {
        type: 'bar',
        data: {
            labels: roomLabels,
            datasets: [{
                data: roomCounts,
                backgroundColor: gold,
                borderRadius: 4
            }]
        },
        options: {
            indexAxis: 'y',
            responsive: true,
            scales: {
                x: { beginAtZero: true, ticks: { stepSize: 1 } }
            }
        }
    });

    // 4. Duration Distribution (bar)
    var durHist = analyticsData.duration_histogram || [];
    var durLabels = durHist.map(function(d) { return d.label; });
    var durCounts = durHist.map(function(d) { return d.count; });

    new Chart(document.getElementById('chart-duration'), {
        type: 'bar',
        data: {
            labels: durLabels,
            datasets: [{
                data: durCounts,
                backgroundColor: blue,
                borderRadius: 4
            }]
        },
        options: {
            responsive: true,
            scales: {
                y: { beginAtZero: true, ticks: { stepSize: 1 } }
            }
        }
    });

    // 5. Encounter Outcomes (stacked bar)
    var encounters = analyticsData.encounter_outcomes || {};
    var encLabels = Object.keys(encounters);
    var outcomeTypes = new Set();
    encLabels.forEach(function(enc) {
        Object.keys(encounters[enc]).forEach(function(o) { outcomeTypes.add(o); });
    });
    var outcomeList = Array.from(outcomeTypes);
    var outcomeColors = { victory: green, defeated: red, fled: yellow, examined: blue };

    var encDatasets = outcomeList.map(function(outcome) {
        return {
            label: outcome,
            data: encLabels.map(function(enc) { return encounters[enc][outcome] || 0; }),
            backgroundColor: outcomeColors[outcome] || purple,
            borderRadius: 3
        };
    });

    new Chart(document.getElementById('chart-encounters'), {
        type: 'bar',
        data: { labels: encLabels, datasets: encDatasets },
        options: {
            responsive: true,
            plugins: { legend: { display: true, position: 'top' } },
            scales: {
                x: { stacked: true },
                y: { stacked: true, beginAtZero: true, ticks: { stepSize: 1 } }
            }
        }
    });

    // 6. Death Causes (pie)
    var deaths = analyticsData.death_causes || {};
    var deathLabels = Object.keys(deaths);
    var deathCounts = deathLabels.map(function(d) { return deaths[d]; });

    if (deathLabels.length > 0) {
        new Chart(document.getElementById('chart-deaths'), {
            type: 'pie',
            data: {
                labels: deathLabels,
                datasets: [{
                    data: deathCounts,
                    backgroundColor: [red, orange, yellow, purple, blue, green],
                    borderWidth: 0
                }]
            },
            options: {
                responsive: true,
                plugins: { legend: { display: true, position: 'right' } }
            }
        });
    }

    // 7. Completion Funnel (horizontal bar)
    var funnel = analyticsData.completion_funnel || [];
    var funnelLabels = funnel.map(function(f) { return f.stage; });
    var funnelCounts = funnel.map(function(f) { return f.count; });

    new Chart(document.getElementById('chart-funnel'), {
        type: 'bar',
        data: {
            labels: funnelLabels,
            datasets: [{
                data: funnelCounts,
                backgroundColor: function(ctx) {
                    var total = funnelCounts[0] || 1;
                    var ratio = funnelCounts[ctx.dataIndex] / total;
                    return 'rgba(74,222,128,' + (0.3 + ratio * 0.7).toFixed(2) + ')';
                },
                borderRadius: 4
            }]
        },
        options: {
            indexAxis: 'y',
            responsive: true,
            scales: {
                x: { beginAtZero: true, ticks: { stepSize: 1 } }
            }
        }
    });
})();
