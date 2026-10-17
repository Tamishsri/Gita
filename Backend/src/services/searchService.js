// Verse search across all 701 verses — references ("2.47", "BG 18.66",
// "chapter 2 verse 47") resolve directly; everything else is a ranked search
// (core theme > emotional tone > life situation > translation > the rest).
// The logic lives in the shared Wisdom Engine so offline search is identical.

const engine = require('../engine');

module.exports = {
    searchVerses: engine.searchVerses,
    parseVerseRef: engine.parseVerseRef,
    scoreVerse: engine.searchScore
};
