// Immich Duplicate Auto-Resolver (Shift+C Confirm & Video Pause)
let count = 0;
let autoTimer = null;
let isPausedForVideo = false;
let batchLimit = 100;
let batchDelay = 1200;

function processGroup() {
    // 1. Find all "File name" text labels
    const allNodes = Array.from(document.querySelectorAll('*'));
    let labels = allNodes.filter(el => {
        const text = el.textContent ? el.textContent.trim() : '';
        return text.toLowerCase() === 'file name' && el.children.length === 0;
    });

    if (labels.length < 2) {
        labels = allNodes.filter(el => {
            return (el.innerText || '').toLowerCase().includes('file name') && el.children.length <= 1;
        });
    }

    if (labels.length < 2) {
        console.warn("Could not find duplicate file cards on page.");
        return null;
    }

    // 2. Identify the card container for each photo/video
    const cards = labels.map(label => {
        let p = label.parentElement;
        while (p && p !== document.body) {
            if (p.innerText.includes('File size')) {
                const matches = (p.innerText.match(/file name/gi) || []).length;
                if (matches === 1) {
                    return p;
                }
            }
            p = p.parentElement;
        }
        return label.parentElement ? label.parentElement.parentElement : null;
    }).filter(Boolean);

    const uniqueCards = [...new Set(cards)];

    if (uniqueCards.length < 2) {
        console.warn("Could not isolate individual duplicate cards.");
        return null;
    }

    // 3. Read filenames, current status (Keep / Bin), and check for videos
    const videoExtensions = /\.(mp4|mov|mkv|webm|avi|flv|m4v|3gp|wmv|ts|ogv|m2ts)/i;

    const items = uniqueCards.map(card => {
        const text = card.innerText || '';
        
        const match = text.match(/File name\s*\n?\s*([^\n]+)/i);
        let fileName = match ? match[1].trim() : '';
        
        if (!fileName) {
            const extMatch = text.match(/[\w\.\-]+\.(jpg|jpeg|png|heic|webp|dng|mov|mp4|mkv|avi)/i);
            fileName = extMatch ? extMatch[0] : text;
        }

        const badges = Array.from(card.querySelectorAll('*')).filter(el => el.children.length === 0);
        const isKeep = badges.some(el => el.textContent.trim() === 'Keep');
        const isBin = badges.some(el => el.textContent.trim() === 'Bin');

        return { card, fileName, length: fileName.length, isKeep, isBin, text };
    });

    // Detect if any item in the group is a video
    const hasVideo = items.some(item => {
        return videoExtensions.test(item.fileName) || 
               videoExtensions.test(item.text) || 
               item.card.querySelector('video') !== null;
    });

    // 4. Sort: Shortest filename first (Keep)
    items.sort((a, b) => a.length - b.length);
    const keepItem = items[0];

    // 5. Toggle states if needed
    items.forEach(item => {
        const shouldBeBin = (item !== keepItem);

        if (shouldBeBin && !item.isBin) {
            toggleCardState(item.card);
        } else if (!shouldBeBin && !item.isKeep) {
            toggleCardState(item.card);
        }
    });

    return {
        savedName: keepItem.fileName,
        isVideo: hasVideo
    };
}

function toggleCardState(card) {
    const badge = Array.from(card.querySelectorAll('*')).find(el => {
        const txt = el.textContent.trim();
        return (txt === 'Bin' || txt === 'Keep') && el.children.length === 0;
    });

    if (badge) {
        badge.click();
    } else {
        const btn = card.querySelector('button') || card;
        btn.click();
    }
}

// Dispatches Shift + C to confirm deduplication natively in Immich
function pressShiftC() {
    const eventDetails = {
        key: 'C',
        code: 'KeyC',
        keyCode: 67,
        which: 67,
        shiftKey: true,
        bubbles: true,
        cancelable: true
    };

    window.dispatchEvent(new KeyboardEvent('keydown', eventDetails));
    document.dispatchEvent(new KeyboardEvent('keydown', eventDetails));
}

function startBatch(limit = 100, delayMs = 1200) {
    if (autoTimer || isPausedForVideo) {
        console.warn("Process is already running or paused!");
        return;
    }

    count = 0;
    batchLimit = limit;
    batchDelay = delayMs;
    isPausedForVideo = false;

    console.log(`Starting automated batch processing for ${limit} duplicate groups...`);
    startBatchLoop();
}

function startBatchLoop() {
    if (autoTimer) clearInterval(autoTimer);

    autoTimer = setInterval(() => {
        if (isPausedForVideo) return;

        if (count >= batchLimit) {
            stopBatch();
            console.log(`Done! Processed ${batchLimit} duplicate groups.`);
            return;
        }

        const result = processGroup();

        if (!result) {
            stopBatch();
            console.log("Stopped: No duplicate cards found or reached end of list.");
            return;
        }

        count++;
        console.log(`[${count}/${batchLimit}] Saved: ${result.savedName}` + (result.isVideo ? " (Video detected)" : ""));

        if (result.isVideo) {
            pauseForVideo(result.savedName);
            return;
        }

        // Automatically trigger Shift + C to confirm deduplication
        setTimeout(() => {
            pressShiftC();
        }, 300);

    }, batchDelay);
}

function pauseForVideo(fileName) {
    if (autoTimer) {
        clearInterval(autoTimer);
        autoTimer = null;
    }
    isPausedForVideo = true;
    console.warn(`Video detected: "${fileName}". Batch paused. Press Shift + C to confirm and resume batch.`);
}

function stopBatch() {
    if (autoTimer) {
        clearInterval(autoTimer);
        autoTimer = null;
    }
    isPausedForVideo = false;
    console.log(`Process stopped. Total processed: ${count} groups.`);
}

// Shortcut triggers
document.addEventListener('keydown', (e) => {
    // Detect manual Shift + C press when paused on video
    if (e.shiftKey && (e.key === 'C' || e.key === 'c' || e.code === 'KeyC')) {
        if (isPausedForVideo) {
            console.log("Shift + C detected. Resuming automated batch processing...");
            isPausedForVideo = false;

            // Wait for Immich to complete deduplication and load next group, then resume loop
            setTimeout(() => {
                startBatchLoop();
            }, 1000);
        }
    } else if (e.key === 'F2') {
        startBatch(100);
    }
});

console.log("Immich Duplicate Resolver loaded! Press F2 or run startBatch(100) to start.");
