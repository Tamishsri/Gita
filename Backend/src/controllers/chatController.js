const { generateResponse } = require('../services/aiService');

const MAX_TEXT_LENGTH = 2000;
const RESPONSE_DELAY_MS = process.env.NODE_ENV === 'test' ? 0 : 900;

// @desc    Talk with the sanctuary
// @route   POST /api/chat   { text?, mood?, settings?, history?, exclude? }
// @access  Public
//
// history: the person's last few messages, so follow-ups keep their feeling.
// exclude: verse ids they have recently been shown, so answers stay fresh.
exports.chat = async (req, res) => {
    try {
        const { text, mood, settings, history, exclude, another } = req.body || {};

        if (!text && !mood) {
            return res.status(400).json({ msg: 'Please provide text or mood.' });
        }
        if ((text != null && typeof text !== 'string') || (mood != null && typeof mood !== 'string')) {
            return res.status(400).json({ msg: 'Text and mood must be strings.' });
        }
        if (text && text.length > MAX_TEXT_LENGTH) {
            return res.status(400).json({ msg: `Please keep your message under ${MAX_TEXT_LENGTH} characters.` });
        }
        if ((history != null && !Array.isArray(history)) || (exclude != null && !Array.isArray(exclude))) {
            return res.status(400).json({ msg: 'history and exclude must be arrays.' });
        }

        const response = generateResponse({ text, mood, settings, history, exclude, another });

        // A short, deliberate pause: the sanctuary answers calmly, never instantly.
        // Crisis responses are never delayed.
        const delay = response.context?.crisis_detected ? 0 : RESPONSE_DELAY_MS;
        setTimeout(() => res.json(response), delay);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
};
