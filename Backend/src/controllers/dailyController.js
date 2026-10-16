const { getVerses } = require('../services/aiService');

// @desc    Get verse of the day (for Silent Mode)
// @route   GET /api/daily
// @access  Public
exports.getDailyVerse = (req, res) => {
    try {
        const verses = getVerses();
        if (!verses.length) {
            return res.status(404).json({ msg: 'No verses available' });
        }

        // Use date as seed for consistent daily verse
        const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
        const seed = today.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
        const index = seed % verses.length;

        const verse = verses[index];

        res.json({
            verse: verse,
            date: today
        });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
};
