// Immich Duplicate Auto-Resolver
// Automatically resolve duplicates in Immich while preserving original (short) filenames

let count = 0;
let autoTimer = null;

function processGroup() {
    // 1. Find all "File name" labels
    const fileNameLabels = Array.from(document.querySelectorAll('*')).filter(
        el => el.children.length === 0 && el.textContent.trim() === 'File name'
    );

    if (fileNameLabels.length < 2) {
        console.warn("Could not find duplicate cards on the page.");
        return null;
    }

    // 2. Find card containers
    const cards = fileNameLabels.map(label => {
        let card = label.parentElement;
        while (card && !card.querySelector('img')) {
            card = card.parentElement;
        }
        return card;
    }).filter(Boolean);

    const uniqueCards = [...new Set(cards)];

    if (uniqueCards.length < 2) {
        console.warn("Could not separate cards.");
        return null;
    }

    // Check: Stop if group contains more than 2 photos
    //if (uniqueCards.length > 2) {
      //  console.warn(`In current group: ${uniqueCards.length} photos (more than 2). Automated processing stopped for manual inspection.`);
        //return "TOO_MANY_CARDS";
    //}

    // 3. Read filenames and current status
    const items = uniqueCards.map(card => {
        const text = card.innerText || '';
        const match = text.match(/File name\s*\n?\s*([^\n]+)/i);
        const fileName = match ? match[1].trim() : text;

        const elements = Array.from(card.querySelectorAll('*'));
        const isKeep = elements.some(el => el.children.length === 0 && el.textContent.trim() === 'Keep');
        const isBin = elements.some(el => el.children.length === 0 && el.textContent.trim() === 'Bin');

        return { card, fileName, length: fileName.length, isKeep, isBin };
    });

    // 4. Sort (shortest filename should be Keep)
    items.sort((a, b) => a.length - b.length);
    const keepItem = items[0];

    // 5. Check and adjust status if necessary
    items.forEach(item => {
        const shouldBeBin = (item !== keepItem);
        if (shouldBeBin) {
            if (item.isKeep || !item.isBin) clickCard(item.card);
        } else {
            if (item.isBin || !item.isKeep) clickCard(item.card);
        }
    });

    // Return the saved filename
    return keepItem.fileName;
}

function clickCard(card) {
    const clickable = card.querySelector('img') || card;
    clickable.click();
}

function nextGroup() {
    // Navigate to next group (Shift + C)
    document.dispatchEvent(new KeyboardEvent('keydown', {
        key: 'C',
        code: 'KeyC',
        keyCode: 67,
        which: 67,
        shiftKey: true,
        bubbles: true
    }));
}

// Start processing a batch of N photos
function startBatch(limit = 100, delayMs = 900) {
    if (autoTimer) {
        console.warn("Process is already running!");
        return;
    }

    count = 0;
    console.log(`Starting automated processing: ${limit} photos scheduled.`);

    autoTimer = setInterval(() => {
        if (count >= limit) {
            stopBatch();
            console.log(`Done! Processed ${limit} duplicates. Script stopped.`);
            return;
        }

        const savedName = processGroup();

        // Stop if more than 2 photos found in group
        if (savedName === "TOO_MANY_CARDS") {
            stopBatch();
            console.log("Process stopped: found a group with more than 2 photo");
