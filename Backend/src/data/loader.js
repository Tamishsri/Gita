const fs = require('fs');
const path = require('path');

let allVerses = [];
let allChapters = [];

const DATASET = path.join(__dirname, '../../../Dataset/Phase_1');

// In a deployment only this service's folder ships, so the build writes the
// whole Gita into one file beside this loader (see scripts/bundle.js).
function loadBundled() {
    try {
        const bundled = require('./gita.generated.json');
        allVerses = bundled.verses;
        allChapters = bundled.chapters;
        console.log(`Loaded ${allVerses.length} verses & ${allChapters.length} chapters from the bundled dataset.`);
        return true;
    } catch {
        return false;
    }
}

const loadData = () => {
    if (!fs.existsSync(DATASET) && loadBundled()) return;
    try {
        const datasetPath = DATASET;
        let tempVerses = [];
        let tempChapters = [];

        for (let i = 1; i <= 18; i++) {
            const chapterDir = path.join(datasetPath, `Chapter_${i}`);
            const versesPath = path.join(chapterDir, 'verses.json');
            const metaPath = path.join(chapterDir, 'meta.json');

            let chapterVersesCount = 0;

            // 1. Load Verses
            if (fs.existsSync(versesPath)) {
                try {
                    let fileContent = fs.readFileSync(versesPath, 'utf-8');
                    let verses;
                    try {
                        verses = JSON.parse(fileContent);
                    } catch (parseErr) {
                        // Resilient fallback: sanitize non-breaking spaces and trailing commas
                        const sanitized = fileContent
                            .replace(/\u00a0/g, ' ')
                            .replace(/,(\s*})/g, '$1');
                        verses = JSON.parse(sanitized);
                    }

                    const enrichedVerses = verses.map(v => {
                        const parts = v.id ? v.id.split('_') : [i, 0];
                        const chapterNum = parseInt(parts[0]) || i;
                        const verseNum = parseInt(parts[1]) || 0;
                        return {
                            ...v,
                            chapter: chapterNum,
                            verse_number: verseNum,
                            verse: verseNum // Alias for compatibility
                        };
                    });

                    chapterVersesCount = enrichedVerses.length;
                    tempVerses = [...tempVerses, ...enrichedVerses];
                } catch (chapterErr) {
                    console.error(`Failed to load Chapter ${i} verses:`, chapterErr.message);
                }
            }

            // 2. Load Chapter Metadata
            if (fs.existsSync(metaPath)) {
                try {
                    const metaContent = fs.readFileSync(metaPath, 'utf-8');
                    const meta = JSON.parse(metaContent);
                    tempChapters.push({
                        ...meta,
                        chapter: i,
                        verses_count: chapterVersesCount
                    });
                } catch (metaErr) {
                    console.error(`Failed to load Chapter ${i} meta:`, metaErr.message);
                    tempChapters.push({
                        chapter: i,
                        name_english: `Chapter ${i}`,
                        name_sanskrit: '',
                        summary_short: '',
                        verses_count: chapterVersesCount
                    });
                }
            } else {
                tempChapters.push({
                    chapter: i,
                    name_english: `Chapter ${i}`,
                    name_sanskrit: '',
                    summary_short: '',
                    verses_count: chapterVersesCount
                });
            }

            console.log(`Loaded Chapter ${i}: ${chapterVersesCount} verses & metadata`);
        }

        allVerses = tempVerses;
        allChapters = tempChapters.sort((a, b) => a.chapter - b.chapter);
        console.log(`\nSUCCESS: Loaded total ${allVerses.length} verses & ${allChapters.length} chapters into memory.`);
    } catch (err) {
        console.error('Error loading data:', err);
    }
};

const getVerses = () => allVerses;
const getChaptersMeta = () => allChapters;
const getChapterMeta = (ch) => allChapters.find(c => c.chapter === parseInt(ch));

module.exports = { loadData, getVerses, getChaptersMeta, getChapterMeta };
