// ==UserScript==
// @name         Footage Sourcing App (Core)
// @namespace    http://tampermonkey.net/
// @version      8.2.7
// @description  Core logic for the Footage Sourcing App, managing UI, API requests, and automation features.
// @grant        none
// ==/UserScript==

(function waitForConfig() {
    'use strict';

    // Check if the config is available
    if (typeof window.FOOTAGE_APP_CONFIG === 'undefined' || !window.FOOTAGE_APP_CONFIG.WEBAPP_URL) {
        console.warn('⏳ Waiting for FOOTAGE_APP_CONFIG...');
        setTimeout(waitForConfig, 100);  // Retry after 100ms
        return;
    }

    const WEBAPP_URL = window.FOOTAGE_APP_CONFIG.WEBAPP_URL;

    console.log('✅ Footage Sourcing App (Core) loaded.');
    console.log('🌐 Using WebApp URL:', WEBAPP_URL);

    //----------------------------------------------------------------
    // PLATFORM DETECTION + SEARCH URL
    //----------------------------------------------------------------
    function detectPlatform() {
        const host = window.location.host;
        if (host.includes("storyblocks.com")) return "storyblocks";
        if (host.includes("envato.com") || host.includes("elements.envato.com")) return "envato";
        return "unknown";
    }

    function getPlatformSearchUrl(platform, keyword) {
        const encoded = encodeURIComponent(keyword);
        switch(platform) {
            case "storyblocks":
                return `https://www.storyblocks.com/all-video/search/${encoded}?search-origin=search_bar`;
            case "envato":
                return `https://elements.envato.com/stock-video/${encoded}`;
            default:
                return `https://www.google.com/search?q=${encoded}`;
        }
    }

    //----------------------------------------------------------------
    // CSS
    //----------------------------------------------------------------
    const styles = `
        /* Button Styles */
        .copy-url-button {
            background-color: #2196F3 !important;
            color: white !important;
            padding: 8px 16px !important;
            border-radius: 4px !important;
            cursor: pointer !important;
            margin-right: 8px !important;
            transition: all 0.3s ease !important;
            border: none !important;
            outline: none !important;
            font-family: inherit !important;
            font-size: 13px !important;
        }
        .copy-url-button:disabled {
            opacity: 0.7 !important;
            cursor: not-allowed !important;
            background-color: #4a5568 !important;
        }
        .copy-url-button.processing {
            background-color: #2196F3 !important;
            cursor: wait !important;
        }
        .copy-url-button.success {
            background-color: #45b058 !important;
        }

        /* Video item states */
        .video-added {
            border: 4px solid #45b058 !important;
            box-shadow: 0 0 15px rgba(69, 176, 88, 0.5) !important;
        }
        .video-inprogress {
            border: 4px solid #2196F3 !important;
            box-shadow: 0 0 15px rgba(33, 150, 243, 0.5) !important;
        }
        .timestamp-badge {
            position: absolute !important;
            top: 8px !important;
            right: 8px !important;
            background-color: #45b058 !important;
            color: #ffffff !important;
            padding: 8px 16px !important;
            border-radius: 4px !important;
            font-size: 14px !important;
            font-weight: 600 !important;
            z-index: 9999 !important;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important;
            box-shadow: 0 2px 4px rgba(0,0,0,0.2) !important;
            white-space: nowrap !important;
            pointer-events: none !important;
            display: block !important;
            visibility: visible !important;
        }
        .timestamp-badge.inprogress {
            background-color: #2196F3 !important;
        }
        .button-container {
            display: flex !important;
            gap: 8px !important;
            margin-top: 5px !important;
            opacity: 1 !important;
            visibility: visible !important;
        }

        /* Script Viewer Styles */
        #script-window {
            position: fixed;
            bottom: 0px;
            left: 50%;
            transform: translateX(-50%);
            /* Weniger transparent für bessere Lesbarkeit */
            background: rgba(26, 32, 44, 0.98);
            color: white;
            padding: 15px;
            border-radius: 8px 8px 0 0;
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            font-size: 13px;
            z-index: 10000;
            width: 600px;
            max-width: 90vw;
            line-height: 1.5;
            transition: height 0.3s, padding 0.3s;
        }
        /* Header with title and two toggles: one for expand/collapse and one for minimize */
        #script-window-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            font-weight: 600;
            margin-bottom: 10px;
            font-size: 15px;
        }
        #script-toggle, #minimize-toggle {
            cursor: pointer;
            font-size: 14px;
            margin-left: 10px;
        }
        #script-window-content {
            display: block;
        }
        /* In minimized mode, extra controls (controls row, comment & jump) werden ausgeblendet */
        #script-window.minimized .script-footer,
        #script-window.minimized #comment-container,
        #script-window.minimized #jump-row,
        #script-window.minimized #controls-row {
            display: none !important;
        }
        /* But keep timestamp, script content and keywords visible */
        #script-window.minimized {
            padding: 5px 15px;
        }
        #script-content {
            white-space: pre-wrap;
            font-family: monospace;
            font-size: 13px;
            line-height: 1.6;
            max-height: 150px;
            overflow-y: auto;
            margin-bottom: 12px;
        }
        #script-keywords {
            margin-top: 10px;
            font-family: inherit;
            font-size: 13px;
            background: rgba(26, 32, 44, 0.98);
            padding-top: 10px;
        }
        #script-timestamp {
            margin-bottom: 12px;
            color: #fdd835;
            font-size: 13px;
            display: flex;
            align-items: center;
            gap: 8px;
        }
        #script-timestamp a {
            color: #fdd835;
            text-decoration: underline;
            cursor: pointer;
        }
        #script-keywords a {
            color: #ffd700;
            margin-right: 8px;
            text-decoration: underline;
            cursor: pointer;
        }
        .script-footer {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-top: 10px;
            padding-top: 10px;
            border-top: 1px solid rgba(255, 255, 255, 0.1);
        }
        .navigation-buttons {
            display: flex;
            gap: 8px;
        }
        .select-container {
            display: flex;
            gap: 8px;
        }
        select {
            background: rgba(26, 32, 44, 0.98);
            color: white;
            border: 1px solid rgba(255, 255, 255, 0.2);
            border-radius: 4px;
            padding: 4px 8px;
            font-size: 12px;
            cursor: pointer;
        }
        select:hover {
            border-color: rgba(255, 255, 255, 0.4);
        }
        .progress-info {
            font-size: 12px;
            color: #fdd835;
            margin-top: 8px;
            text-align: right;
        }

        /* Envato-specific styles */
        .n4MAkDTq {
            position: relative !important;
            margin: 4px !important;
            padding: 4px !important;
        }
        .n4MAkDTq .dc9DIUal {
            position: relative !important;
            overflow: visible !important;
        }
        .CPzl2ah6 .ES35fwD6 {
            opacity: 1 !important;
            visibility: visible !important;
        }

        /* Comment & Jump-to row combined */
        #controls-row {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-top: 10px;
        }
        #comment-toggle, #jump-toggle {
            cursor: pointer;
            color: #fdd835;
            text-decoration: underline;
        }
        /* Comment field remains unchanged and is now larger by default */
        #comment-container {
            margin-top: 10px;
            display: none;
        }
        #comment-textarea {
            width: 100%;
            min-height: 80px;
            background: #333;
            color: #fff;
            border-radius: 4px;
            border: 1px solid #555;
            padding: 5px;
            resize: vertical;
            font-size: 13px;
        }
        /* Jump-to filter field appearance fix */
        #timestamp-search {
            background-color: #000;
            color: #fff;
            border: 1px solid #555;
            padding: 4px 8px;
        }
    `;
    const styleSheet = document.createElement('style');
    styleSheet.textContent = styles;
    document.head.appendChild(styleSheet);

    //----------------------------------------------------------------
    // STATE
    //----------------------------------------------------------------
    let currentScriptData = null;
    let allTimestamps = [];
    let sourcerList = []; // Loaded from GAS via getOverview once

    //----------------------------------------------------------------
    // VideoHistory
    //----------------------------------------------------------------
    const VideoHistory = {
        get: () => GM_getValue('videoHistory', {}),
        add: (url, timestamp, currentCount, maxClips) => {
            const history = VideoHistory.get();
            history[url] = { timestamp, currentCount, maxClips };
            GM_setValue('videoHistory', history);
            localStorage.setItem(`video_state_${url}`, JSON.stringify({
                timestamp, currentCount, maxClips, added: true
            }));
        },
        remove: (url) => {
            const history = VideoHistory.get();
            delete history[url];
            GM_setValue('videoHistory', history);
            localStorage.removeItem(`video_state_${url}`);
        },
        getClipData: (url) => VideoHistory.get()[url],
        reset: () => {
            if (confirm('Are you sure you want to reset all video history? This cannot be undone.')) {
                GM_setValue('videoHistory', {});
                Object.keys(localStorage).forEach(key => {
                    if (key.startsWith('video_state_')) {
                        localStorage.removeItem(key);
                    }
                });
                location.reload();
            }
        }
    };

    //----------------------------------------------------------------
    // Helper Functions
    //----------------------------------------------------------------
    // Helper to escape quotes in attribute values
    function escapeAttr(text) {
        return text.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }

    function highlightComplexTerms(scriptText, complexTerms) {
        if (!complexTerms || !complexTerms.length) return scriptText;
        complexTerms.sort((a, b) => b.term.length - a.term.length);
        let updated = scriptText;
        for (const ct of complexTerms) {
            const regex = new RegExp(ct.term, 'gi');
            const safeDefinition = escapeAttr(ct.definition);
            const link = `<a href="https://www.google.com/search?tbm=isch&q=${encodeURIComponent(ct.term)}"
                            title="${safeDefinition}" target="_blank"
                            style="color:#03fc0f;text-decoration:underline;">$&</a>`;
            updated = updated.replace(regex, link);
        }
        return updated;
    }

    //----------------------------------------------------------------
    // Script Viewer (UI)
    //----------------------------------------------------------------
    function addScriptWindow() {
        const scriptWindow = document.createElement('div');
        scriptWindow.id = 'script-window';
        scriptWindow.innerHTML = `
            <div id="script-window-header">
                <span id="script-viewer-title">Script Viewer</span>
                <div>
                    <span id="minimize-toggle" style="margin-right:10px; cursor:pointer;">[Minimize]</span>
                    <span id="script-toggle" style="cursor:pointer;">▼</span>
                </div>
            </div>
            <div id="script-window-content">
                <div id="script-timestamp">Loading...</div>
                <div id="script-content">Script: Loading...</div>
                <div id="script-keywords"></div>
                <div id="controls-row" style="display: flex; justify-content: space-between; align-items: center;">
                    <span id="comment-toggle">(show Comment)</span>
                    <span id="jump-toggle">(show Jump)</span>
                </div>
                <div id="comment-container">
                    <textarea id="comment-textarea" placeholder="Enter your comment..."></textarea>
                    <button id="save-comment" class="copy-url-button" style="margin-top:5px;">Save Comment</button>
                </div>
                <div id="jump-row" style="display:none; margin-top:10px;">
                    <!-- Jump-to functionality -->
                    <div class="timestamp-jump-container">
                        <input type="text" id="timestamp-search" placeholder="Search 00:00..." />
                        <label for="timestamp-check-open" style="font-size:12px;">
                          <input type="checkbox" id="timestamp-check-open" style="vertical-align: middle;" />
                          Open Only
                        </label>
                        <select id="timestamp-select"></select>
                        <button id="timestamp-apply" class="copy-url-button">Apply</button>
                    </div>
                </div>
                <div class="script-footer">
                    <div class="navigation-buttons">
                        <button id="back-button" class="copy-url-button">◀ Back</button>
                        <button id="skip-button" class="copy-url-button">Skip ▶</button>
                    </div>
                    <div class="select-container">
                        <select id="language-select"></select>
                        <select id="sourcer-select"></select>
                    </div>
                </div>
                <div class="progress-info"></div>
            </div>
        `;
        document.body.appendChild(scriptWindow);

        // Grab references
        const header = document.getElementById('script-window-header');
        const content = document.getElementById('script-window-content');
        const toggle = document.getElementById('script-toggle');
        const minimizeToggle = document.getElementById('minimize-toggle');
        const scriptViewerTitle = document.getElementById('script-viewer-title');

        const skipButton = document.getElementById('skip-button');
        const backButton = document.getElementById('back-button');
        const languageSelect = document.getElementById('language-select');
        const sourcerSelect = document.getElementById('sourcer-select');

        const commentToggle = document.getElementById('comment-toggle');
        const commentContainer = document.getElementById('comment-container');
        const saveCommentBtn = document.getElementById('save-comment');
        const commentTextarea = document.getElementById('comment-textarea');

        const jumpToggle = document.getElementById('jump-toggle');
        const jumpRow = document.getElementById('jump-row');
        const timestampSearch = document.getElementById('timestamp-search');
        const timestampCheckOpen = document.getElementById('timestamp-check-open');
        const timestampSelect = document.getElementById('timestamp-select');
        const timestampApplyBtn = document.getElementById('timestamp-apply');

        // Ensure button backgrounds are blue
        skipButton.style.backgroundColor = '#2196F3';
        backButton.style.backgroundColor = '#2196F3';
        timestampApplyBtn.style.backgroundColor = '#2196F3';

        // Toggle collapse/expand of the main content
        let isOpen = GM_getValue('scriptViewerState', false);
        function updateState(newState) {
            isOpen = newState;
            content.style.display = isOpen ? 'block' : 'none';
            toggle.textContent = isOpen ? '▲' : '▼';
            GM_setValue('scriptViewerState', isOpen);
        }
        header.addEventListener('click', (event) => {
            if (event.target === toggle || event.target === scriptViewerTitle) {
                updateState(!isOpen);
            }
        });
        updateState(isOpen);

        // Toggle minimize mode (hide extra controls including controls row)
        let isMinimized = GM_getValue('isMinimized', false);
        function updateMinimized(state) {
            isMinimized = state;
            const scriptWindow = document.getElementById('script-window');
            if (isMinimized) {
                scriptWindow.classList.add('minimized');
                minimizeToggle.textContent = "[Expand]";
            } else {
                scriptWindow.classList.remove('minimized');
                minimizeToggle.textContent = "[Minimize]";
            }
            GM_setValue('isMinimized', isMinimized);
        }
        minimizeToggle.addEventListener('click', (event) => {
            event.stopPropagation();
            updateMinimized(!isMinimized);
        });
        updateMinimized(isMinimized);

        // Navigation
        skipButton.addEventListener('click', () => handleNavigation(skipButton, 'skip', 'Skipping...'));
        backButton.addEventListener('click', () => handleNavigation(backButton, 'back', 'Going back...'));

        async function handleNavigation(btn, action, loadingText) {
            if (btn.disabled) return;
            const origText = btn.textContent;
            btn.disabled = true;
            btn.textContent = loadingText;
            btn.classList.add('processing');
            try {
                await sendToGAS(null, action);
            } catch (err) {
                console.error(`[TM] ${action} failed:`, err);
            } finally {
                btn.disabled = false;
                btn.textContent = origText;
                btn.classList.remove('processing');
            }
        }

        // Language & Sourcer
        languageSelect.addEventListener('change', () => {
            GM_setValue('selectedLanguage', languageSelect.value);
            if (currentScriptData && currentScriptData.scripts) {
                updateScriptWindow({
                    ...currentScriptData,
                    scriptContent: currentScriptData.scripts[languageSelect.value]
                });
            }
        });
        sourcerSelect.addEventListener('change', () => {
            GM_setValue('selectedSourcer', sourcerSelect.value);
        });

        // Combine Comment and Jump-to toggles on one row
        commentToggle.addEventListener('click', () => {
            const visible = commentContainer.style.display === 'block';
            commentContainer.style.display = visible ? 'none' : 'block';
            commentToggle.textContent = visible ? '(show Comment)' : '(hide Comment)';
        });
        jumpToggle.addEventListener('click', () => {
            const isVisible = jumpRow.style.display === 'block';
            if (!isVisible) {
                // Only populate the jump dropdown when showing it
                populateTimestampSelect();
            }
            jumpRow.style.display = isVisible ? 'none' : 'block';
            jumpToggle.textContent = isVisible ? '(show Jump)' : '(hide Jump)';
        });

        // --- Bugfix 1: Save Comment button shows "Saved" nur kurz ---
        saveCommentBtn.addEventListener('click', async () => {
            if (saveCommentBtn.disabled) return;
            const origText = "Save Comment";  // Standardtext, zu dem zurückgekehrt wird
            saveCommentBtn.disabled = true;
            saveCommentBtn.textContent = 'Processing...';
            saveCommentBtn.classList.add('processing');
            const text = commentTextarea.value.trim();
            try {
                await sendToGASComment(text);
                saveCommentBtn.classList.add('success');
                saveCommentBtn.textContent = 'Saved';
                setTimeout(() => {
                    saveCommentBtn.classList.remove('success');
                    saveCommentBtn.textContent = origText;
                }, 2000);
            } catch (err) {
                console.error('[TM] Save comment failed:', err);
                saveCommentBtn.textContent = 'Error!';
                setTimeout(() => {
                    saveCommentBtn.textContent = origText;
                }, 2000);
            } finally {
                saveCommentBtn.disabled = false;
                saveCommentBtn.classList.remove('processing');
            }
        });

        timestampSearch.addEventListener('input', () => { populateTimestampSelect(); });
        timestampCheckOpen.addEventListener('change', () => { populateTimestampSelect(); });
        timestampApplyBtn.addEventListener('click', async () => {
            if (timestampApplyBtn.disabled) return;
            const val = timestampSelect.value;
            if (!val) return;
            const oldText = timestampApplyBtn.textContent;
            timestampApplyBtn.disabled = true;
            timestampApplyBtn.textContent = 'Processing...';
            timestampApplyBtn.classList.add('processing');
            try {
                await goToRow(parseInt(val, 10));
            } catch (err) {
                console.error('[TM] goToRow failed:', err);
            } finally {
                timestampApplyBtn.disabled = false;
                timestampApplyBtn.textContent = oldText;
                timestampApplyBtn.classList.remove('processing');
            }
        });

        function populateTimestampSelect() {
            timestampSelect.innerHTML = '';
            const searchVal = timestampSearch.value.toLowerCase();
            const onlyOpen = timestampCheckOpen.checked;
            allTimestamps.forEach(row => {
                const time = row.timestamp || "";
                const labelCore = `${time} [${row.countC}/${row.clips}]`;
                const isComplete = (row.countC >= row.clips) || (row.footageStatus === 'SOURCED');
                const symbol = isComplete ? '✅' : '❌';
                if (searchVal && !time.toLowerCase().includes(searchVal)) return;
                if (onlyOpen && isComplete) return;
                const label = labelCore + ' ' + symbol;
                const opt = document.createElement('option');
                opt.value = row.rowNumber;
                opt.textContent = label;
                timestampSelect.appendChild(opt);
            });
        }
    }

    function updateScriptWindow(result) {
        if (!result) return;
        currentScriptData = result;
        GM_setValue("currentScriptData", result);

        const {
            timestamp,
            gsheetLink,
            scriptContent,
            analysis,
            urlCount,
            maxClips,
            languages,
            currentSourcer,
            comment,
            progress,
            sheetTitle
        } = result;

        const scriptViewerTitle = document.getElementById('script-viewer-title');
        const timestampElem = document.getElementById('script-timestamp');
        const scriptElem = document.getElementById('script-content');
        const keywordsElem = document.getElementById('script-keywords');
        const languageSelect = document.getElementById('language-select');
        const sourcerSelect = document.getElementById('sourcer-select');
        const progressInfo = document.querySelector('.progress-info');
        const commentTextarea = document.getElementById('comment-textarea');

        if (!timestampElem || !scriptElem || !keywordsElem) {
            console.warn("[TM] Missing elements in ScriptViewer, skipping update.");
            return;
        }

        if (sheetTitle && scriptViewerTitle) {
            scriptViewerTitle.textContent = `Script Viewer – ${sheetTitle}`;
        }

        const link = gsheetLink || '#';
        timestampElem.innerHTML = `
            <a href="${link}" target="_blank">
                Timestamp: ${timestamp || 'N/A'}
            </a>
            <span class="clip-count">(Sourced: ${urlCount} of ${maxClips} clips)</span>
        `;

        let finalScript = scriptContent || "";
        if (analysis && analysis.complexTerms) {
            finalScript = highlightComplexTerms(finalScript, analysis.complexTerms);
        }
        scriptElem.innerHTML = "Script:\n" + finalScript;

        // Keywords (restored from your old logic)
        keywordsElem.innerHTML = "";
        if (analysis && analysis.keywords && analysis.keywords.length) {
            const currentPlatform = detectPlatform();
            const linkHtmlArray = analysis.keywords.map((kw, idx) => {
                const url = getPlatformSearchUrl(currentPlatform, kw);
                return (idx < analysis.keywords.length - 1)
                    ? `<a href="${url}" target="_blank">${kw}</a>,`
                    : `<a href="${url}" target="_blank">${kw}</a>`;
            });
            keywordsElem.innerHTML = `<div style="margin-top:10px;">Keywords: ${linkHtmlArray.join(' ')}</div>`;
        }

        // Rebuild language dropdown.
        if (languageSelect && languages) {
            languageSelect.innerHTML = '';
            languages.forEach(lang => {
                const opt = document.createElement('option');
                opt.value = lang;
                opt.textContent = lang;
                if (lang === GM_getValue('selectedLanguage', 'EN')) {
                    opt.selected = true;
                }
                languageSelect.appendChild(opt);
            });
        }

        // Rebuild Footage Sourcer dropdown only if the user is not interacting with it
        if (sourcerSelect && document.activeElement !== sourcerSelect) {
            sourcerSelect.innerHTML = '';
            const noneOpt = document.createElement('option');
            noneOpt.value = "";
            noneOpt.textContent = "[None]";
            sourcerSelect.appendChild(noneOpt);
            const globalSourcer = GM_getValue('selectedSourcer', '');
            const valueToSet = (currentSourcer && currentSourcer !== "") ? currentSourcer : globalSourcer;
            sourcerList.forEach(s => {
                const opt = document.createElement('option');
                opt.value = s;
                opt.textContent = s;
                sourcerSelect.appendChild(opt);
            });
            // Only update the dropdown value if the user is not actively changing it
            if (!sourcerSelect.matches(':focus')) {
                sourcerSelect.value = valueToSet;
            }
        }

        // Do not overwrite the comment field if the user is typing
        if (commentTextarea && document.activeElement !== commentTextarea) {
            commentTextarea.value = comment || "";
        }

        // Show progress info if available.
        if (progress) {
            const { openTimestamps, totalTimestamps, totalClips, sourcedClips } = progress;
            progressInfo.textContent = `Timestamps: ${openTimestamps}/${totalTimestamps} open | Clips: ${sourcedClips}/${totalClips} sourced`;
        }
    }

    //----------------------------------------------------------------
    // Communication with GAS
    //----------------------------------------------------------------
    function sendToGAS(url, action = 'add') {
        return new Promise((resolve, reject) => {
            const payload = {
                action,
                url,
                language: GM_getValue('selectedLanguage', 'EN'),
                sourcer: GM_getValue('selectedSourcer', '')
            };
            // If adding a video, immediately set an in-progress badge
            if (action === 'add' && url) {
                setInProgressBadge(url);
            }
            GM_xmlhttpRequest({
                method: 'POST',
                url: WEBAPP_URL,
                headers: { 'Content-Type': 'application/json' },
                data: JSON.stringify(payload),
                onload: (resp) => {
                    try {
                        const json = JSON.parse(resp.responseText);
                        if (json.status === 'success') {
                            if (json.switchToNextRow) {
                                updateScriptWindow(json);
                                setTimeout(() => { updateScriptWindow(json.switchToNextRow); }, 400);
                            } else {
                                updateScriptWindow(json);
                            }
                            // On successful add, mark the video as added (which updates the badge)
                            if (action === 'add' && url) {
                                markVideoSuccess(url, json.timestamp, json.urlCount, json.maxClips);
                            }
                            resolve(json);
                        } else {
                            console.error('[TM] GAS returned error:', json.message);
                            // On error, revert the in-progress badge
                            if (action === 'add' && url) {
                                revertInProgressBadge(url);
                            }
                            reject(new Error(json.message));
                        }
                    } catch (err) {
                        console.error('[TM] JSON parse error in sendToGAS:', err);
                        if (action === 'add' && url) {
                            revertInProgressBadge(url);
                        }
                        reject(err);
                    }
                },
                onerror: (err) => {
                    console.error('[TM] onerror in sendToGAS:', err);
                    if (action === 'add' && url) {
                        revertInProgressBadge(url);
                    }
                    reject(err);
                }
            });
        });
    }

    function sendToGASSourcer(newSourcer) {
        return new Promise((resolve, reject) => {
            const payload = {
                action: 'setSourcer',
                sourcer: newSourcer || '',
                language: GM_getValue('selectedLanguage', 'EN')
            };
            GM_xmlhttpRequest({
                method: 'POST',
                url: WEBAPP_URL,
                headers: { 'Content-Type': 'application/json' },
                data: JSON.stringify(payload),
                onload: (resp) => {
                    try {
                        const json = JSON.parse(resp.responseText);
                        if (json.status === 'success') { updateScriptWindow(json); resolve(json); }
                        else { reject(new Error(json.message)); }
                    } catch (err) { reject(err); }
                },
                onerror: (err) => reject(err)
            });
        });
    }

    function sendToGASComment(comment) {
        return new Promise((resolve, reject) => {
            const payload = {
                action: 'setComment',
                comment,
                language: GM_getValue('selectedLanguage', 'EN'),
                sourcer: GM_getValue('selectedSourcer', '')
            };
            GM_xmlhttpRequest({
                method: 'POST',
                url: WEBAPP_URL,
                headers: { 'Content-Type': 'application/json' },
                data: JSON.stringify(payload),
                onload: (resp) => {
                    try {
                        const json = JSON.parse(resp.responseText);
                        if (json.status === 'success') { updateScriptWindow(json); resolve(json); }
                        else { reject(new Error(json.message)); }
                    } catch (err) { reject(err); }
                },
                onerror: (err) => reject(err)
            });
        });
    }

    function goToRow(rowNumber) {
        return new Promise((resolve, reject) => {
            const payload = { action: 'goToRow', rowNumber };
            GM_xmlhttpRequest({
                method: 'POST',
                url: WEBAPP_URL,
                headers: { 'Content-Type': 'application/json' },
                data: JSON.stringify(payload),
                onload: (resp) => {
                    try {
                        const json = JSON.parse(resp.responseText);
                        if (json.status === 'success') { updateScriptWindow(json); resolve(json); }
                        else { reject(new Error(json.message)); }
                    } catch (err) { reject(err); }
                },
                onerror: (err) => reject(err)
            });
        });
    }

    //----------------------------------------------------------------
    // VIDEO ITEM UI: "Copy" + "Undo"
    //----------------------------------------------------------------
    function createButton(text, onClick, color = '#1a202c') {
        const btn = document.createElement('button');
        btn.className = 'copy-url-button';
        btn.style.backgroundColor = color;
        btn.innerHTML = `<span>${text}</span>`;
        btn.addEventListener('click', async () => {
            if (btn.classList.contains('success') || btn.disabled) return;
            btn.disabled = true;
            const oldText = btn.querySelector('span').textContent;
            btn.querySelector('span').textContent = 'Processing...';
            btn.classList.add('processing');
            try {
                await onClick();
                btn.classList.add('success');
                btn.querySelector('span').textContent = 'Edit';
                btn.style.cursor = 'not-allowed';
            } catch (err) {
                console.error('[TM] Button action failed:', err);
                btn.querySelector('span').textContent = 'Error!';
                setTimeout(() => {
                    btn.querySelector('span').textContent = oldText;
                }, 2000);
            } finally {
                btn.classList.remove('processing');
            }
        });
        return btn;
    }

    // --- In-Progress Badge Functions ---
    function setInProgressBadge(url) {
        const { itemDiv } = findItemDiv(url);
        if (!itemDiv) return;
        itemDiv.classList.remove('video-added');
        itemDiv.classList.add('video-inprogress');
        let badge = itemDiv.querySelector('.timestamp-badge');
        if (!badge) {
            badge = document.createElement('div');
            badge.className = 'timestamp-badge';
            itemDiv.appendChild(badge);
        }
        badge.classList.add('inprogress');
        const rowTimestamp = currentScriptData && currentScriptData.timestamp ? currentScriptData.timestamp : '…';
        const sourcedCount = currentScriptData && typeof currentScriptData.urlCount !== 'undefined' ? currentScriptData.urlCount : 0;
        const maxClips = currentScriptData && typeof currentScriptData.maxClips !== 'undefined' ? currentScriptData.maxClips : '?';
        const nextClip = sourcedCount + 1;
        badge.textContent = `In Progress to ${rowTimestamp} (${nextClip} of ${maxClips})`;
    }

    function revertInProgressBadge(url) {
        const { itemDiv } = findItemDiv(url);
        if (!itemDiv) return;
        itemDiv.classList.remove('video-inprogress');
        const badge = itemDiv.querySelector('.timestamp-badge');
        if (badge) badge.remove();
    }

    function markVideoSuccess(url, rowTimestamp, currentCount, maxClips) {
        VideoHistory.add(url, rowTimestamp, currentCount, maxClips);
        const { itemDiv } = findItemDiv(url);
        if (!itemDiv) return;
        itemDiv.classList.remove('video-inprogress');
        itemDiv.classList.add('video-added');
        let badge = itemDiv.querySelector('.timestamp-badge');
        if (!badge) {
            badge = document.createElement('div');
            badge.className = 'timestamp-badge';
            itemDiv.appendChild(badge);
        }
        badge.classList.remove('inprogress');
        badge.textContent = `Added to ${rowTimestamp} (${currentCount} of ${maxClips})`;
    }

    function findItemDiv(url) {
        const platform = detectPlatform();
        const itemSelector = platform === 'envato' ? '.n4MAkDTq' : '.stock-item';
        const items = document.querySelectorAll(itemSelector);
        for (const it of items) {
            const link = it.querySelector('a[data-testid="title-link"], a.image-link');
            if (link && link.href === url) return { itemDiv: it };
        }
        return {};
    }

    function restoreVideoStates() {
        const platform = detectPlatform();
        const itemSelector = platform === 'envato' ? '.n4MAkDTq' : '.stock-item';
        const items = document.querySelectorAll(itemSelector);
        items.forEach(item => {
            const url = item.querySelector('a[data-testid="title-link"], a.image-link')?.href;
            if (!url) return;
            const stateJson = localStorage.getItem(`video_state_${url}`);
            if (stateJson) {
                try {
                    const st = JSON.parse(stateJson);
                    if (st.added) {
                        markVideoSuccess(url, st.timestamp, st.currentCount, st.maxClips);
                        const copyButton = item.querySelector('.copy-url-button');
                        if (copyButton) {
                            copyButton.classList.add('success');
                            // Hier "Edit" durch "Added" ersetzen:
                            copyButton.querySelector('span').textContent = 'Added';
                            copyButton.disabled = true;
                            copyButton.style.cursor = 'not-allowed';
                        }
                    }
                } catch (err) {
                    console.error('[TM] Error restoring video state:', err);
                }
            }
        });
    }

    function addButtons() {
        const platform = detectPlatform();
        let itemSelector, detailLinkSelector, parentSelector;
        if (platform === 'envato') {
            itemSelector = '.n4MAkDTq';
            detailLinkSelector = 'a[data-testid="title-link"]';
            parentSelector = '.CPzl2ah6 .ES35fwD6';
        } else if (platform === 'storyblocks') {
            itemSelector = '.stock-item';
            detailLinkSelector = 'a.image-link';
            parentSelector = '.absolute.flex.items-center.justify-between';
        } else { return; }
        const iconRows = document.querySelectorAll(parentSelector);
        iconRows.forEach(iconRow => {
            if (iconRow.querySelector('.copy-url-button')) return;
            const itemDiv = iconRow.closest(itemSelector);
            if (!itemDiv) return;
            const detailLink = itemDiv.querySelector(detailLinkSelector);
            if (!detailLink || !detailLink.href) return;
            const histData = VideoHistory.getClipData(detailLink.href);
            const buttonContainer = document.createElement('div');
            buttonContainer.className = 'button-container';
            const copyBtn = createButton(histData ? 'Added' : 'Copy URL', async () => {
                await sendToGAS(detailLink.href, 'add');
            });
            const undoBtn = createButton('Undo', async () => {
    await sendToGAS(detailLink.href, 'undo');
    VideoHistory.remove(detailLink.href);
    itemDiv.classList.remove('video-added', 'video-inprogress');
    const badge = itemDiv.querySelector('.timestamp-badge');
    if (badge) badge.remove();
    copyBtn.classList.remove('success');
    copyBtn.disabled = false;
    copyBtn.style.cursor = 'pointer';
    copyBtn.querySelector('span').textContent = 'Copy URL';
}, '#dc3545');

undoBtn.style.cssText = 'background-color: #dc3545 !important; color: white !important;';

            if (histData) {
                copyBtn.classList.add('success');
                // Hier ebenfalls "Edit" zu "Added" ändern:
                copyBtn.querySelector('span').textContent = 'Added';
                copyBtn.disabled = true;
                copyBtn.style.cursor = 'not-allowed';
            }
            buttonContainer.appendChild(copyBtn);
            buttonContainer.appendChild(undoBtn);
            iconRow.appendChild(buttonContainer);
            if (histData) {
                markVideoSuccess(detailLink.href, histData.timestamp, histData.currentCount, histData.maxClips);
            }
        });
    }

    // -------------------- RESET BUTTON (moved to bottom left outside SV) --------------------
    function addResetButton() {
        const resetButton = document.createElement('button');
        resetButton.className = 'copy-url-button';
        resetButton.style.cssText = `
    position: fixed;
    bottom: 20px;
    left: 20px;
    z-index: 9999;
    background-color: #dc3545 !important;
    color: white !important;
`;

        resetButton.textContent = 'Reset History';
        resetButton.addEventListener('click', VideoHistory.reset);
        document.body.appendChild(resetButton);
    }

    // -------------------- OBSERVERS & POLL --------------------
    const observer = new MutationObserver(() => {
        addButtons();
        restoreVideoStates();
    });

    function checkForUpdates() {
        const saved = GM_getValue("currentScriptData", null);
        if (saved && JSON.stringify(saved) !== JSON.stringify(currentScriptData)) {
            updateScriptWindow(saved);
        }
    }

    function getOverview() {
        return new Promise((resolve, reject) => {
            const payload = { action: 'getOverview' };
            GM_xmlhttpRequest({
                method: 'POST',
                url: WEBAPP_URL,
                headers: { 'Content-Type': 'application/json' },
                data: JSON.stringify(payload),
                onload: (resp) => {
                    try {
                        const json = JSON.parse(resp.responseText);
                        if (json.status === 'success' && Array.isArray(json.allRows)) {
                            resolve(json);
                        } else {
                            reject(new Error(json.message || 'Invalid getOverview response'));
                        }
                    } catch (err) { reject(err); }
                },
                onerror: (err) => reject(err)
            });
        });
    }

    async function init() {
        addScriptWindow();
        addResetButton();
        addButtons();
        restoreVideoStates();

        observer.observe(document.body, { childList: true, subtree: true });
        setInterval(checkForUpdates, 1000);

        try {
            const ov = await getOverview();
            allTimestamps = ov.allRows || [];
            // Cache sourcer list – they are assumed static during the session.
            sourcerList = ov.sourcerList || [];
            const sourcerSelect = document.getElementById('sourcer-select');
            if (sourcerSelect) {
                sourcerSelect.innerHTML = '';
                const noneOpt = document.createElement('option');
                noneOpt.value = "";
                noneOpt.textContent = "[None]";
                sourcerSelect.appendChild(noneOpt);
                sourcerList.forEach(s => {
                    const opt = document.createElement('option');
                    opt.value = s;
                    opt.textContent = s;
                    sourcerSelect.appendChild(opt);
                });
                // Preserve global selected sourcer.
                sourcerSelect.value = GM_getValue('selectedSourcer', '');
            }
            if (ov.sheetTitle && GM_getValue("currentScriptData", null) === null) {
                const titleElem = document.getElementById('script-viewer-title');
                if (titleElem) { titleElem.textContent = `Script Viewer – ${ov.sheetTitle}`; }
            }
        } catch (err) {
            console.error('[TM] getOverview failed:', err);
        }
        const saved = GM_getValue("currentScriptData", null);
        if (saved) { updateScriptWindow(saved); }
    }

    init();
})();
