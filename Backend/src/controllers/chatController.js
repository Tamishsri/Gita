const { generateResponse } = require('../services/aiService');

const MAX_TEXT_LENGTH = 2000;
const RESPONSE_DELAY_MS = process.env.NODE_ENV === 'test' ? 0 : 1000;

// @desc    Chat with AI (Deterministic)
// @route   POST /api/chat
// @access  Public
exports.chat = async (req, res) => {
    try {
        const { text, mood, settings } = req.body || {};

        if (!text && !mood) {
            return res.status(400).json({ msg: 'Please provide text or mood.' });
        }
        if ((text != null && typeof text !== 'string') || (mood != null && typeof mood !== 'string')) {
            return res.status(400).json({ msg: 'Text and mood must be strings.' });
        }
        if (text && text.length > MAX_TEXT_LENGTH) {
            return res.status(400).json({ msg: `Please keep your message under ${MAX_TEXT_LENGTH} characters.` });
        }

        const response = generateResponse(text, mood, settings && typeof settings === 'object' ? settings : {});

        // A short, deliberate pause: the sanctuary answers calmly, never instantly.
        setTimeout(() => {
            res.json(response);
        }, RESPONSE_DELAY_MS);

    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
};
