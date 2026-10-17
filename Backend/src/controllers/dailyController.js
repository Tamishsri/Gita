const engine = require('../../../shared/wisdom-engine');
const { getVerses } = require('../data/loader');

// @desc    Verse of the day
// @route   GET /api/daily?date=YYYY-MM-DD
// @access  Public
//
// The client sends its *local* date so the verse changes at the person's
// midnight, not the server's. Without it, the server's UTC date is used.
exports.getDailyVerse = (req, res) => {
    try {
        const verses = getVerses();
        if (!verses.length) {
            return res.status(404).json({ msg: 'No verses available' });
        }

        const requested = req.query.date;
        if (requested !== undefined && !engine.isValidDate(requested)) {
            return res.status(400).json({ msg: 'date must be YYYY-MM-DD' });
        }
        const date = requested || new Date().toISOString().split('T')[0];

        res.json({
            verse: engine.dailyVerse(verses, date),
            date
        });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
};
