// Makes the backend self-contained for deployment (Vercel builds it as its
// own service and ships only the files it can trace from src/app.js).
//
//   src/data/gita.generated.json   all 701 verses and 18 chapters, read once
//                                  from Dataset/ and written as one file the
//                                  loader requires statically
//   src/shared/wisdom-engine.js    a copy of the one shared engine
//
// Both are build output (gitignored). Locally the backend still reads
// Dataset/ and shared/ directly, so nothing here can go stale during work.

const fs = require('fs');
const path = require('path');
const { loadData, getVerses, getChaptersMeta } = require('../src/data/loader');

const root = path.join(__dirname, '..');
const repo = path.join(root, '..');

const quiet = console.log;
console.log = () => {};
loadData();
console.log = quiet;

const verses = getVerses();
const chapters = getChaptersMeta();
if (verses.length < 700 || chapters.length !== 18) {
    console.error(`Dataset incomplete: ${verses.length} verses, ${chapters.length} chapters. Is Dataset/Phase_1 present?`);
    process.exit(1);
}

const dataFile = path.join(root, 'src/data/gita.generated.json');
fs.writeFileSync(dataFile, JSON.stringify({ verses, chapters }));
console.log(`  ✓ src/data/gita.generated.json (${verses.length} verses, ${chapters.length} chapters)`);

const engineSource = path.join(repo, 'shared/wisdom-engine.js');
const engineCopy = path.join(root, 'src/shared/wisdom-engine.js');
fs.mkdirSync(path.dirname(engineCopy), { recursive: true });
fs.copyFileSync(engineSource, engineCopy);
console.log('  ✓ src/shared/wisdom-engine.js');
