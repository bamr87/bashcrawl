/* Bashcrawl Observatory — Core App JS */

// Theme Toggle
function toggleTheme() {
    const html = document.documentElement;
    const current = html.getAttribute('data-theme');
    const next = current === 'dark' ? 'light' : 'dark';
    html.setAttribute('data-theme', next);
    localStorage.setItem('bashcrawl-theme', next);
    updateThemeButton(next);
}

function updateThemeButton(theme) {
    const btn = document.querySelector('.theme-toggle');
    if (btn) btn.textContent = theme === 'dark' ? '🌙' : '☀️';
}

// Restore theme on load
(function initTheme() {
    const saved = localStorage.getItem('bashcrawl-theme');
    if (saved) {
        document.documentElement.setAttribute('data-theme', saved);
        updateThemeButton(saved);
    }
})();

// Utility: human-readable duration
function formatDuration(seconds) {
    if (seconds < 60) return seconds.toFixed(1) + 's';
    const m = Math.floor(seconds / 60);
    const s = Math.round(seconds % 60);
    return m + 'm ' + s + 's';
}

// Utility: human-readable file size
function formatSize(bytes) {
    if (bytes < 1024) return bytes + 'B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + 'KB';
    return (bytes / (1024 * 1024)).toFixed(1) + 'MB';
}

// Utility: truncate string
function truncate(str, len) {
    if (!str || str.length <= len) return str;
    return str.substring(0, len) + '…';
}
