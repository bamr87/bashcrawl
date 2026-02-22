/* Bashcrawl Observatory — Screenshot Gallery JS */

(function() {
    const gallery = document.getElementById('gallery');
    if (!gallery) return;

    const items = document.querySelectorAll('.filmstrip-item');
    const img = document.getElementById('gallery-img');
    const indexEl = document.getElementById('gallery-index');
    const nameEl = document.getElementById('gallery-name');
    const triggerEl = document.getElementById('gallery-trigger');
    const commandEl = document.getElementById('gallery-command');
    const sizeEl = document.getElementById('gallery-size');

    let current = 0;
    let slideshowTimer = null;

    function updateGallery(index) {
        if (!items.length) return;
        index = Math.max(0, Math.min(index, items.length - 1));
        current = index;

        const item = items[index];
        const src = item.dataset.src;
        const name = item.dataset.name;
        const trigger = item.dataset.trigger || '';
        const command = item.dataset.command || '';
        const sizeBytes = parseInt(item.dataset.size || '0', 10);

        // Update main image
        if (img) img.src = src;

        // Update counter
        if (indexEl) indexEl.textContent = index + 1;

        // Update info strip
        if (nameEl) nameEl.textContent = name;
        if (triggerEl) triggerEl.textContent = trigger;
        if (commandEl) commandEl.textContent = command;
        if (sizeEl) sizeEl.textContent = formatSize(sizeBytes);

        // Update filmstrip active state
        items.forEach(function(el) { el.classList.remove('active'); });
        item.classList.add('active');

        // Scroll filmstrip item into view (horizontal)
        item.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }

    // Public API (attached to window for onclick handlers)
    window.galleryGoTo = function(index) {
        updateGallery(index);
    };

    window.galleryPrev = function() {
        updateGallery(current > 0 ? current - 1 : items.length - 1);
    };

    window.galleryNext = function() {
        updateGallery(current < items.length - 1 ? current + 1 : 0);
    };

    window.toggleSlideshow = function() {
        const btn = document.getElementById('slideshow-btn');
        if (slideshowTimer) {
            clearInterval(slideshowTimer);
            slideshowTimer = null;
            if (btn) { btn.textContent = '⏵'; btn.classList.remove('playing'); }
        } else {
            slideshowTimer = setInterval(function() {
                galleryNext();
            }, 2000);
            if (btn) { btn.textContent = '⏸'; btn.classList.add('playing'); }
        }
    };

    // Keyboard navigation
    document.addEventListener('keydown', function(e) {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
        switch (e.key) {
            case 'ArrowLeft':
                e.preventDefault();
                galleryPrev();
                break;
            case 'ArrowRight':
                e.preventDefault();
                galleryNext();
                break;
            case 'Home':
                e.preventDefault();
                updateGallery(0);
                break;
            case 'End':
                e.preventDefault();
                updateGallery(items.length - 1);
                break;
            case ' ':
                e.preventDefault();
                toggleSlideshow();
                break;
        }
    });
})();
