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

    // Detect single-frame mode (no filmstrip items)
    const isMultiFrame = items.length > 1;

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
        if (!isMultiFrame) return;
        updateGallery(current > 0 ? current - 1 : items.length - 1);
    };

    window.galleryNext = function() {
        if (!isMultiFrame) return;
        updateGallery(current < items.length - 1 ? current + 1 : 0);
    };

    window.toggleSlideshow = function() {
        if (!isMultiFrame) return;
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

    // Session navigation helpers
    function navigateSession(direction) {
        var links = document.querySelectorAll('.session-nav-btn:not(.disabled)');
        for (var i = 0; i < links.length; i++) {
            var link = links[i];
            if (direction === 'prev' && link.textContent.indexOf('Prev') !== -1) {
                window.location.href = link.href;
                return;
            }
            if (direction === 'next' && link.textContent.indexOf('Next') !== -1) {
                window.location.href = link.href;
                return;
            }
        }
    }

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
            case 'j':
            case 'J':
                e.preventDefault();
                navigateSession('prev');
                break;
            case 'k':
            case 'K':
                e.preventDefault();
                navigateSession('next');
                break;
        }
    });
})();
