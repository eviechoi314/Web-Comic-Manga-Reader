document.addEventListener('DOMContentLoaded', () => {

    const outputElement = document.getElementById('output');
    const progressTextElement = document.querySelector('.progress-text');
    const sePreConElement = document.querySelector('.se-pre-con');
    const currYearElement = document.getElementById('currYear');
    const wrapElement = document.querySelector('.wrap');
    const collapseBtn = document.getElementById('collapseBtn');
    const selectFolderBtn = document.getElementById('selectFolderBtn');
    const quickReadBtn = document.getElementById('quickReadBtn');
    const toggleUploadBtn = document.getElementById('toggleUploadBtn');
    const backToLibraryBtn = document.getElementById('backToLibraryBtn');
    const recentComicsEl = document.getElementById('recentComics');
    const recentComicsListEl = document.getElementById('recentComicsList');
    const allComicsEl = document.getElementById('allComics');
    const allComicsListEl = document.getElementById('allComicsList');
    const dividerOrEl = document.getElementById('dividerOr');
    const dropzoneEl = document.getElementById('dropzone');
    const initialViewEl = document.getElementById('initialView');
    const libraryViewEl = document.getElementById('libraryView');
    const quickReadViewEl = document.getElementById('quickReadView');
    const footerCollapsedTextEl = document.getElementById('footerCollapsedText');
    const browserNoticeEl = document.getElementById('browserNotice');
    const changeFolderBtn = document.getElementById('changeFolderBtn');
    const currentFolderNameEl = document.getElementById('currentFolderName');

    let comicsDirectoryHandle = null;
    let isLibraryMode = false;

    // current year
    currYearElement.innerHTML = (new Date()).getFullYear();

    // check if File System Access API is supported
    const supportsFileSystemAccess = 'showDirectoryPicker' in window;

    if (supportsFileSystemAccess) {
        selectFolderBtn.style.display = 'flex';
        dividerOrEl.style.display = 'block';
    } else {
        browserNoticeEl.style.display = 'block';
        quickReadBtn.classList.remove('folder-btn-secondary');
        quickReadBtn.classList.add('folder-btn-primary');
    }

    loadArchiveFormats(['rar', 'zip', 'tar']);

    document.querySelector('.footer-collapsed').addEventListener('click', async () => {
        wrapElement.classList.remove('collapsed');
        if (isLibraryMode && comicsDirectoryHandle) {
            const permission = await comicsDirectoryHandle.queryPermission({ mode: 'read' });
            if (permission === 'granted') {
                showLibraryMode();
            } else {
                showReconnectButton();
            }
        } else if (!isLibraryMode) {
            showQuickReadMode();
        } else {
            initialViewEl.style.display = 'block';
            libraryViewEl.style.display = 'none';
            quickReadViewEl.style.display = 'none';
        }
    });

    collapseBtn.addEventListener('click', (e) => {
        e.preventDefault();
        wrapElement.classList.add('collapsed');
    });

    if (selectFolderBtn) {
        selectFolderBtn.addEventListener('click', async () => {
            try {
                if (comicsDirectoryHandle) {
                    const permission = await comicsDirectoryHandle.requestPermission({ mode: 'read' });
                    if (permission === 'granted') {
                        await showLibraryMode();
                        return;
                    }
                }
                const dirHandle = await window.showDirectoryPicker({ mode: 'read' });
                const permission = await dirHandle.requestPermission({ mode: 'read' });
                if (permission !== 'granted') return;
                comicsDirectoryHandle = dirHandle;
                await saveDirectoryHandle(dirHandle);
                await showLibraryMode();
            } catch (err) {
                if (err.name !== 'AbortError') console.error('Error selecting folder:', err);
            }
        });
    }

    if (quickReadBtn) quickReadBtn.addEventListener('click', () => showQuickReadMode());
    if (toggleUploadBtn) toggleUploadBtn.addEventListener('click', () => showQuickReadMode());

    if (backToLibraryBtn) {
        backToLibraryBtn.addEventListener('click', async () => {
            if (comicsDirectoryHandle) {
                const permission = await comicsDirectoryHandle.queryPermission({ mode: 'read' });
                if (permission === 'granted') {
                    await showLibraryMode();
                } else {
                    try {
                        const newPermission = await comicsDirectoryHandle.requestPermission({ mode: 'read' });
                        if (newPermission === 'granted') await showLibraryMode();
                        else showReconnectButton();
                    } catch (err) {
                        console.error('Failed to request permission:', err);
                        showReconnectButton();
                    }
                }
            }
        });
    }

    if (changeFolderBtn) {
        changeFolderBtn.addEventListener('click', async () => {
            try {
                const dirHandle = await window.showDirectoryPicker({ mode: 'read' });
                const permission = await dirHandle.requestPermission({ mode: 'read' });
                if (permission !== 'granted') return;
                comicsDirectoryHandle = dirHandle;
                await saveDirectoryHandle(dirHandle);
                await showLibraryMode();
            } catch (err) {
                if (err.name !== 'AbortError') console.error('Error selecting folder:', err);
            }
        });
    }

    if (supportsFileSystemAccess) {
        loadDirectoryHandle().then(async (result) => {
            if (result.handle && result.hasPermission) {
                comicsDirectoryHandle = result.handle;
                await showLibraryMode();
            } else if (result.handle && !result.hasPermission) {
                comicsDirectoryHandle = result.handle;
                showReconnectButton();
            }
        });
    }

    // ── Reader state ──────────────────────────────────────────────────────────

    let readerPages   = [];
    let readerIndex   = 0;
    let readerTwoPage = false;
    let readerRTL     = false;
    let readerBump    = 0;      // 0 or 1 — shifts spread alignment by one page
    let readerBarTimeout = null;

    // Lightbox state
    const ZOOM_LEVELS = [10, 15, 25, 33, 50, 67, 75, 100, 125, 150, 200, 250, 300, 400, 500, 600, 800, 1000, 1200, 1600, 2000];
    let lightboxZoomPct = 100;   // current zoom as a percentage of natural size
    let lightboxFitPct  = 100;   // calculated fit% for this image
    let lightboxAtFit   = true;  // true = use CSS fit behaviour (nice centering)
    let lightboxLabelTimeout = null;

    const readerEl      = document.getElementById('reader');
    const pageA         = document.getElementById('reader-page-a');
    const pageB         = document.getElementById('reader-page-b');
    const pageNumEl     = document.getElementById('reader-page-num');
    const readerBar     = document.getElementById('reader-bar');
    const btn2page      = document.getElementById('reader-btn-2page');
    const btnRTL        = document.getElementById('reader-btn-rtl');
    const btnBump       = document.getElementById('reader-btn-bump');

    function openReader(startIndex) {
        readerIndex = Math.max(0, Math.min(startIndex, readerPages.length - 1));
        if (readerTwoPage) snapToSpread();
        readerEl.style.display = 'flex';
        document.body.style.overflow = 'hidden';
        updateReaderButtons();
        renderReader();
        showReaderBar();
    }

    function closeReader() {
        readerEl.style.display = 'none';
        document.body.style.overflow = '';
        saveLastPageRead(currentComicFilename, readerIndex);
    }

    // Align readerIndex to the nearest valid spread start for the current bump.
    // Valid starts: bump, bump+2, bump+4, ...
    function snapToSpread() {
        if (readerPages.length === 0) return;
        const offset = readerIndex - readerBump;
        if (offset < 0) {
            readerIndex = readerBump;
        } else {
            readerIndex = readerBump + Math.floor(offset / 2) * 2;
        }
        readerIndex = Math.max(0, Math.min(readerIndex, readerPages.length - 1));
    }

    function readerAdvance() {
        const step = readerTwoPage ? 2 : 1;
        readerIndex = Math.min(readerIndex + step, readerPages.length - 1);
        saveLastPageRead(currentComicFilename, readerIndex);
        renderReader();
    }

    function readerBack() {
        const step = readerTwoPage ? 2 : 1;
        const min  = readerTwoPage ? readerBump : 0;
        readerIndex = Math.max(readerIndex - step, min);
        saveLastPageRead(currentComicFilename, readerIndex);
        renderReader();
    }

    function renderReader() {
        if (readerTwoPage) {
            readerEl.classList.add('two-page');
            const i1 = readerIndex;
            const i2 = readerIndex + 1;

            const src1 = readerPages[i1] ? `<img src="${readerPages[i1]}" draggable="false">` : '';
            const src2 = (i2 < readerPages.length && readerPages[i2])
                ? `<img src="${readerPages[i2]}" draggable="false">` : '';

            if (readerRTL) {
                // RTL: right panel = lower page number, left panel = higher
                pageA.innerHTML = src2;
                pageB.innerHTML = src1;
            } else {
                pageA.innerHTML = src1;
                pageB.innerHTML = src2;
            }
            pageB.style.display = 'flex';

            const p1 = i1 + 1;
            const p2 = Math.min(i2 + 1, readerPages.length);
            pageNumEl.textContent = i2 < readerPages.length
                ? `${p1}–${p2} / ${readerPages.length}`
                : `${p1} / ${readerPages.length}`;
        } else {
            readerEl.classList.remove('two-page');
            pageA.innerHTML = `<img src="${readerPages[readerIndex]}" draggable="false">`;
            pageB.innerHTML = '';
            pageB.style.display = 'none';
            pageNumEl.textContent = `${readerIndex + 1} / ${readerPages.length}`;
        }
    }

    function updateReaderButtons() {
        btn2page.classList.toggle('active', readerTwoPage);
        btnRTL.classList.toggle('active', readerRTL);
        btnBump.classList.toggle('active', readerBump === 1);
        btnBump.classList.toggle('enabled', readerTwoPage);
    }

    function showReaderBar() {
        readerBar.classList.add('visible');
        clearTimeout(readerBarTimeout);
        readerBarTimeout = setTimeout(() => readerBar.classList.remove('visible'), 3000);
    }

    // Navigation + lightbox via reader-pages click
    // Zones are pointer-events:none, so all clicks land here.
    // Click on image → lightbox. Click on blank area → navigate.
    const readerPagesEl = document.getElementById('reader-pages');

    readerPagesEl.addEventListener('click', (e) => {
        if (e.target.tagName === 'IMG') {
            lightboxOpen(e.target.src);
            return;
        }
        const rect = readerPagesEl.getBoundingClientRect();
        const clickedLeft = e.clientX < rect.left + rect.width / 2;
        if (clickedLeft) {
            if (readerRTL) readerAdvance(); else readerBack();
        } else {
            if (readerRTL) readerBack(); else readerAdvance();
        }
    });

    // Hover hint arrows
    readerPagesEl.addEventListener('mousemove', (e) => {
        const rect = readerPagesEl.getBoundingClientRect();
        const isLeft = e.clientX < rect.left + rect.width / 2;
        readerPagesEl.classList.toggle('hint-left', isLeft);
        readerPagesEl.classList.toggle('hint-right', !isLeft);
    });
    readerPagesEl.addEventListener('mouseleave', () => {
        readerPagesEl.classList.remove('hint-left', 'hint-right');
    });

    // Show bar on mouse/touch activity
    readerEl.addEventListener('mousemove', showReaderBar);
    readerEl.addEventListener('touchstart', showReaderBar, { passive: true });

    // Close button
    document.getElementById('reader-close').addEventListener('click', closeReader);

    // ── Lightbox ──────────────────────────────────────────────────────────────

    function lightboxOpen(src) {
        const lb      = document.getElementById('lightbox');
        const img     = document.getElementById('lightbox-img');
        const content = document.getElementById('lightbox-content');

        lightboxAtFit = true;
        lb.style.display = 'flex';

        img.onload = () => {
            // Calculate what percentage of natural size the image is shown at when fitted
            const scaleW = content.clientWidth  / img.naturalWidth;
            const scaleH = content.clientHeight / img.naturalHeight;
            lightboxFitPct  = Math.round(Math.min(scaleW, scaleH) * 100);
            lightboxZoomPct = lightboxFitPct;

            // Use CSS fit — browser handles centering perfectly
            img.style.width     = '';
            img.style.height    = '';
            img.style.maxWidth  = '100%';
            img.style.maxHeight = '100%';
            content.style.overflow = 'hidden';
            content.classList.remove('zoomed', 'at-max');
            img.classList.remove('at-max');

            showLightboxZoomLabel();
        };
        img.src = src;
    }

    function lightboxClose() {
        document.getElementById('lightbox').style.display = 'none';
        document.getElementById('lightbox-img').src = '';
        lightboxAtFit   = true;
        lightboxZoomPct = 100;
    }

    function lightboxZoomIn() {
        // Snap to the next standard zoom level above current percentage
        const next = ZOOM_LEVELS.find(z => z > lightboxZoomPct);
        if (next === undefined) return; // already at max (800%)
        lightboxZoomPct = next;
        lightboxAtFit   = false;
        applyLightboxZoom();
        showLightboxZoomLabel();
    }

    function applyLightboxZoom() {
        const img     = document.getElementById('lightbox-img');
        const content = document.getElementById('lightbox-content');
        const atMax   = !ZOOM_LEVELS.some(z => z > lightboxZoomPct);

        img.style.maxWidth   = 'none';
        img.style.maxHeight  = 'none';
        img.style.flexShrink = '0';
        img.style.width      = Math.round(img.naturalWidth * lightboxZoomPct / 100) + 'px';
        img.style.height     = 'auto';
        content.style.overflow = 'auto';
        content.classList.add('zoomed');
        content.classList.toggle('at-max', atMax);
        img.classList.toggle('at-max', atMax);
    }

    function showLightboxZoomLabel() {
        const label = document.getElementById('lightbox-zoom-label');
        label.textContent = `${lightboxZoomPct}%`;
        label.classList.add('visible');
        clearTimeout(lightboxLabelTimeout);
        lightboxLabelTimeout = setTimeout(() => label.classList.remove('visible'), 1200);
    }

    // Lightbox events
    document.getElementById('lightbox-close-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        lightboxClose();
    });

    document.getElementById('lightbox-content').addEventListener('click', (e) => {
        e.stopPropagation();
        lightboxZoomIn();
    });

    document.getElementById('lightbox').addEventListener('click', () => lightboxClose());

    // Mode buttons (stopPropagation so clicks don't hit the nav zones)
    btn2page.addEventListener('click', (e) => {
        e.stopPropagation();
        readerTwoPage = !readerTwoPage;
        if (readerTwoPage) snapToSpread();
        updateReaderButtons();
        renderReader();
    });

    btnRTL.addEventListener('click', (e) => {
        e.stopPropagation();
        readerRTL = !readerRTL;
        updateReaderButtons();
        renderReader();
    });

    btnBump.addEventListener('click', (e) => {
        e.stopPropagation();
        if (!readerTwoPage) return;
        readerBump = readerBump === 0 ? 1 : 0;
        snapToSpread();
        updateReaderButtons();
        renderReader();
    });

    // Keyboard navigation
    document.addEventListener('keydown', (e) => {
        const lbOpen = document.getElementById('lightbox').style.display === 'flex';

        if (lbOpen) {
            if (e.key === 'Escape') lightboxClose();
            return;
        }

        if (readerEl.style.display === 'none' || readerEl.style.display === '') return;

        switch (e.key) {
            case 'ArrowRight':
                e.preventDefault();
                if (readerRTL) readerBack(); else readerAdvance();
                break;
            case 'ArrowLeft':
                e.preventDefault();
                if (readerRTL) readerAdvance(); else readerBack();
                break;
            case 'Escape':
                closeReader();
                break;
        }
    });

    // ── Comic loading ─────────────────────────────────────────────────────────

    let currentComicFilename = '';

    function openComic(file) {
        clearBlobs();
        readerPages = [];
        readerIndex = 0;

        outputElement.style.display = 'none';
        wrapElement.classList.add('collapsed');
        collapseBtn.classList.add('show');
        currentComicFilename = file.name;

        progressTextElement.innerHTML = 'Reading 0/0 pages';
        sePreConElement.style.display = 'block';

        archiveOpenFile(file, (archive, err) => {
            if (archive) {
                readContents(archive);
            } else {
                sePreConElement.style.display = 'none';
                outputElement.innerHTML = `<span style="color:#ef4444;">${err}</span>`;
                outputElement.style.display = 'block';
            }
        });
    }

    async function readContents(archive) {
        // Sort entries by filename so pages are always in order
        const imageEntries = archive.entries
            .filter(e => getExt(e.name) !== '')
            .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));

        const total = imageEntries.length;
        readerPages = new Array(total).fill(null);

        const promises = imageEntries.map((entry, i) => createBlobAsync(entry, i, total));
        await Promise.all(promises);

        progressTextElement.innerHTML = '<span style="color:#4ade80;">Completed!</span>';
        sePreConElement.style.display = 'none';

        generateThumbnailFromFirstImage();

        const startPage = getLastPageRead(currentComicFilename);
        openReader(startPage);
    }

    function createBlobAsync(entry, i, total) {
        return new Promise((resolve) => {
            entry.readData((data) => {
                const blob = new Blob([data], { type: getMIME(entry.name) });
                readerPages[i] = URL.createObjectURL(blob);

                const loaded = readerPages.filter(Boolean).length;
                progressTextElement.innerHTML = `Reading ${loaded}/${total} pages`;

                resolve();
            });
        });
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    function getExt(filename) {
        const ext = filename.split('.').pop();
        return (ext === filename) ? '' : ext;
    }

    function getMIME(filename) {
        const ext = getExt(filename).toLowerCase();
        return { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png',
                 gif: 'image/gif', bmp: 'image/bmp', webp: 'image/webp' }[ext] || 'image/jpeg';
    }

    function clearBlobs() {
        readerPages.forEach(url => { if (url) URL.revokeObjectURL(url); });
        readerPages = [];
    }

    function generateThumbnailFromFirstImage() {
        const src = readerPages[0];
        if (!src) return;
        const img = new Image();
        img.onload = () => {
            try {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                const maxWidth = 100;
                const scale = maxWidth / img.naturalWidth;
                canvas.width = maxWidth;
                canvas.height = img.naturalHeight * scale;
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                const thumbnail = canvas.toDataURL('image/jpeg', 0.7);
                const history = JSON.parse(localStorage.getItem('comic_reader_userpref') || '{}');
                const existing = history[currentComicFilename] || {};
                saveLastPageRead(currentComicFilename, existing.last_page || 0, thumbnail);
            } catch (e) {
                console.error('Thumbnail generation failed:', e);
            }
        };
        img.src = src;
    }

    function saveLastPageRead(filename, pageIndex, thumbnail = null) {
        try {
            const history = JSON.parse(localStorage.getItem('comic_reader_userpref') || '{}');
            const existing = history[filename] || {};
            history[filename] = {
                last_page: pageIndex,
                timestamp: Date.now(),
                thumbnail: thumbnail || existing.thumbnail || null
            };
            localStorage.setItem('comic_reader_userpref', JSON.stringify(history));
        } catch (e) {
            console.error('Failed to save reading history:', e);
        }
    }

    function getLastPageRead(filename) {
        try {
            const history = JSON.parse(localStorage.getItem('comic_reader_userpref') || '{}');
            return history[filename]?.last_page || 0;
        } catch (e) {
            return 0;
        }
    }

    // ── Library / Dropzone ────────────────────────────────────────────────────

    function showReconnectButton() {
        initialViewEl.style.display = 'block';
        libraryViewEl.style.display = 'none';
        quickReadViewEl.style.display = 'none';
        const titleEl = selectFolderBtn.querySelector('.btn-title');
        const subtitleEl = selectFolderBtn.querySelector('.btn-subtitle');
        if (titleEl && subtitleEl) {
            titleEl.textContent = 'Reconnect to Comics Folder';
            subtitleEl.textContent = 'Click to restore access to your library';
        }
    }

    async function showLibraryMode() {
        if (!comicsDirectoryHandle) return;
        isLibraryMode = true;
        initialViewEl.style.display = 'none';
        libraryViewEl.style.display = 'block';
        quickReadViewEl.style.display = 'none';
        footerCollapsedTextEl.textContent = 'Show library';

        if (currentFolderNameEl && comicsDirectoryHandle.name) {
            currentFolderNameEl.innerHTML = `<svg viewBox="0 0 16 16" fill="currentColor"><path d="M1.75 1A1.75 1.75 0 000 2.75v10.5C0 14.216.784 15 1.75 15h12.5A1.75 1.75 0 0016 13.25v-8.5A1.75 1.75 0 0014.25 3H7.5a.25.25 0 01-.2-.1l-.9-1.2C6.07 1.26 5.55 1 5 1H1.75z"/></svg>${comicsDirectoryHandle.name}`;
        }

        const titleEl = selectFolderBtn.querySelector('.btn-title');
        const subtitleEl = selectFolderBtn.querySelector('.btn-subtitle');
        if (titleEl && subtitleEl) {
            titleEl.textContent = 'Select Comics Folder';
            subtitleEl.textContent = 'Auto-track progress, browse all comics';
        }

        await loadRecentComics();
        await loadAllComics();

        if (recentComicsListEl.children.length > 0) recentComicsEl.style.display = 'block';
        allComicsEl.style.display = 'block';
    }

    function showQuickReadMode() {
        isLibraryMode = false;
        initialViewEl.style.display = 'none';
        libraryViewEl.style.display = 'none';
        quickReadViewEl.style.display = 'block';
        footerCollapsedTextEl.textContent = 'Upload another file';

        const titleEl = selectFolderBtn.querySelector('.btn-title');
        const subtitleEl = selectFolderBtn.querySelector('.btn-subtitle');
        if (titleEl && subtitleEl) {
            titleEl.textContent = 'Select Comics Folder';
            subtitleEl.textContent = 'Auto-track progress, browse all comics';
        }

        if (backToLibraryBtn) backToLibraryBtn.style.display = comicsDirectoryHandle ? 'block' : 'none';
    }

    async function loadAllComics() {
        if (!comicsDirectoryHandle) return;
        try {
            const permission = await comicsDirectoryHandle.queryPermission({ mode: 'read' });
            if (permission !== 'granted') {
                allComicsListEl.innerHTML = '<div style="text-align:center;color:var(--muted);padding:20px;font-size:14px;">Permission required to access folder</div>';
                return;
            }

            allComicsListEl.innerHTML = '<div style="text-align:center;padding:20px;"><div class="spinner" style="margin:0 auto;"></div><div style="margin-top:12px;color:var(--muted);font-size:14px;">Scanning folder...</div></div>';

            const comics = [];
            const validExtensions = ['.cbr', '.cbz', '.cbt'];
            for await (const entry of comicsDirectoryHandle.values()) {
                if (entry.kind === 'file') {
                    const ext = '.' + entry.name.split('.').pop().toLowerCase();
                    if (validExtensions.includes(ext)) comics.push(entry.name);
                }
            }

            allComicsListEl.innerHTML = '';

            if (comics.length === 0) {
                allComicsListEl.innerHTML = '<div style="text-align:center;color:var(--muted);padding:20px;font-size:14px;">No comics found in this folder. Make sure your comics have .cbr, .cbz, or .cbt extension.</div>';
                return;
            }

            comics.sort();
            const readingHistory = JSON.parse(localStorage.getItem('comic_reader_userpref') || '{}');

            for (const filename of comics) {
                const comicData = readingHistory[filename];
                const hasThumbnail = comicData?.thumbnail;
                const iconContent = hasThumbnail
                    ? `<img src="${comicData.thumbnail}" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:6px;">`
                    : `<svg viewBox="0 0 16 16"><path d="M3.5 2a1.5 1.5 0 0 0-1.5 1.5v9A1.5 1.5 0 0 0 3.5 14h9a1.5 1.5 0 0 0 1.5-1.5v-9A1.5 1.5 0 0 0 12.5 2h-9zm6.854 6.146a.5.5 0 0 1 0 .708l-3 3a.5.5 0 0 1-.708-.708L8.793 9H5.5a.5.5 0 0 1 0-1h3.293L6.646 5.854a.5.5 0 1 1 .708-.708l3 3z"/></svg>`;

                const item = document.createElement('div');
                item.className = 'recent-comic-item';
                item.innerHTML = `
                    <div class="recent-comic-icon">${iconContent}</div>
                    <div class="recent-comic-info">
                        <div class="recent-comic-name">${filename}</div>
                    </div>`;
                item.addEventListener('click', () => openComicFromFolder(filename));
                allComicsListEl.appendChild(item);
            }
        } catch (err) {
            console.error('Failed to load all comics:', err);
            if (err.name === 'NotFoundError') {
                const folderName = comicsDirectoryHandle ? comicsDirectoryHandle.name : 'directory';
                allComicsListEl.innerHTML = '';
                const errorWrapper = document.createElement('div');
                errorWrapper.style.cssText = 'text-align:center;padding:40px 20px;';
                errorWrapper.innerHTML = `
                    <div style="margin-bottom:10px;color:var(--text);">Failed to load comics from "<strong>${folderName}</strong>"</div>
                    <div style="margin-bottom:25px;color:var(--muted);font-size:14px;">The folder might have been moved, renamed, or deleted.</div>`;
                if (selectFolderBtn) {
                    const btnClone = selectFolderBtn.cloneNode(true);
                    btnClone.id = '';
                    btnClone.style.cssText = 'display:inline-flex;margin:0 auto;';
                    btnClone.addEventListener('click', () => selectFolderBtn.click());
                    errorWrapper.appendChild(btnClone);
                }
                allComicsListEl.appendChild(errorWrapper);
                comicsDirectoryHandle = null;
            } else {
                allComicsListEl.innerHTML = '<div style="text-align:center;color:var(--muted);padding:20px;font-size:14px;">Error loading comics from folder</div>';
            }
        }
    }

    if (window.Dropzone) Dropzone.autoDiscover = false;
    let dropzone = new Dropzone('#dropzone', {
        url: '#',
        acceptedFiles: '.cbr,.cbz,.cbt',
        createImageThumbnails: false,
        autoProcessQueue: false,
        previewsContainer: false,
        maxFiles: 1,
        maxfilesexceeded: function(file) { this.removeAllFiles(); },
        init: function() {
            this.on('addedfile', (file) => openComic(file));
        }
    });

    async function openComicFromFolder(filename) {
        try {
            if (!comicsDirectoryHandle) throw new Error('Directory handle not available');
            const permission = await comicsDirectoryHandle.queryPermission({ mode: 'read' });
            if (permission !== 'granted') {
                const newPermission = await comicsDirectoryHandle.requestPermission({ mode: 'read' });
                if (newPermission !== 'granted') { showReconnectButton(); return; }
            }
            const fileHandle = await comicsDirectoryHandle.getFileHandle(filename);
            const file = await fileHandle.getFile();
            openComic(file);
            setTimeout(async () => {
                if (comicsDirectoryHandle) {
                    await loadRecentComics();
                    if (recentComicsListEl.children.length > 0) recentComicsEl.style.display = 'block';
                }
            }, 500);
        } catch (err) {
            console.error('Failed to open comic:', err);
            if (err.name === 'NotAllowedError') {
                showReconnectButton();
            } else {
                alert('Could not find this comic in the selected folder.');
                await removeComicFromHistory(filename);
            }
        }
    }

    async function loadRecentComics() {
        try {
            const readingHistory = JSON.parse(localStorage.getItem('comic_reader_userpref') || '{}');
            const recentComics = Object.entries(readingHistory)
                .sort((a, b) => b[1].timestamp - a[1].timestamp)
                .slice(0, 5);

            recentComicsListEl.innerHTML = '';
            if (recentComics.length === 0) return;

            for (const [filename, data] of recentComics) {
                const item = document.createElement('div');
                item.className = 'recent-comic-item';
                const iconContent = data.thumbnail
                    ? `<img src="${data.thumbnail}" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:6px;">`
                    : `<svg viewBox="0 0 16 16"><path d="M3.5 2a1.5 1.5 0 0 0-1.5 1.5v9A1.5 1.5 0 0 0 3.5 14h9a1.5 1.5 0 0 0 1.5-1.5v-9A1.5 1.5 0 0 0 12.5 2h-9zm6.854 6.146a.5.5 0 0 1 0 .708l-3 3a.5.5 0 0 1-.708-.708L8.793 9H5.5a.5.5 0 0 1 0-1h3.293L6.646 5.854a.5.5 0 1 1 .708-.708l3 3z"/></svg>`;
                item.innerHTML = `
                    <div class="recent-comic-icon">${iconContent}</div>
                    <div class="recent-comic-info">
                        <div class="recent-comic-name">${filename}</div>
                        <div class="recent-comic-meta">Page ${data.last_page + 1} • ${formatTimestamp(data.timestamp)}</div>
                    </div>`;
                item.addEventListener('click', () => openComicFromFolder(filename));
                recentComicsListEl.appendChild(item);
            }
        } catch (err) {
            console.error('Failed to load recent comics:', err);
        }
    }

    async function removeComicFromHistory(filename) {
        const history = JSON.parse(localStorage.getItem('comic_reader_userpref') || '{}');
        if (history[filename]) {
            delete history[filename];
            localStorage.setItem('comic_reader_userpref', JSON.stringify(history));
            await loadRecentComics();
            if (recentComicsListEl.children.length === 0) recentComicsEl.style.display = 'none';
        }
    }

    function formatTimestamp(timestamp) {
        const diff = Date.now() - timestamp;
        const minutes = Math.floor(diff / 60000);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);
        if (days > 0) return `${days}d ago`;
        if (hours > 0) return `${hours}h ago`;
        if (minutes > 0) return `${minutes}m ago`;
        return 'Just now';
    }

    // ── IndexedDB for directory handle persistence ────────────────────────────

    function openDB() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open('ComicReaderDB', 1);
            request.onerror = () => reject(request.error);
            request.onsuccess = () => resolve(request.result);
            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains('directories')) db.createObjectStore('directories');
            };
        });
    }

    async function saveDirectoryHandle(dirHandle) {
        try {
            const db = await openDB();
            const tx = db.transaction('directories', 'readwrite');
            tx.objectStore('directories').put(dirHandle, 'comicsFolder');
            await tx.complete;
        } catch (err) {
            console.error('Failed to save directory handle:', err);
        }
    }

    async function loadDirectoryHandle() {
        try {
            const db = await openDB();
            const tx = db.transaction('directories', 'readonly');
            const handle = await new Promise((resolve, reject) => {
                const req = tx.objectStore('directories').get('comicsFolder');
                req.onsuccess = () => resolve(req.result);
                req.onerror = () => reject(req.error);
            });
            if (handle) {
                const permission = await handle.queryPermission({ mode: 'read' });
                return { handle, hasPermission: permission === 'granted' };
            }
            return { handle: null, hasPermission: false };
        } catch (err) {
            console.error('Failed to load directory handle:', err);
            return { handle: null, hasPermission: false };
        }
    }

});
