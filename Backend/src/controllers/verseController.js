const { getVerses, getChaptersMeta, getChapterMeta } = require('../data/loader');
const searchService = require('../services/searchService');

// @desc    Get all verses
// @route   GET /api/verses
// @access  Public
exports.getVerses = async (req, res) => {
    try {
        const { chapter, page = 1, limit = 20 } = req.query;
        let verses = getVerses();

        // Filter by chapter
        if (chapter) {
            verses = verses.filter(v => v.chapter === parseInt(chapter));
        }

        // Pagination
        const start = (page - 1) * limit;
        const end = start + parseInt(limit);
        const paginatedVerses = verses.slice(start, end);

        res.json({
            verses: paginatedVerses,
            totalPages: Math.ceil(verses.length / limit),
            currentPage: parseInt(page),
            totalVerses: verses.length
        });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
};

// @desc    Get single verse by ID
// @route   GET /api/verses/:id
// @access  Public
exports.getVerseById = async (req, res) => {
    try {
        const verses = getVerses();
        const verse = verses.find(v => v.id === req.params.id);

        if (!verse) {
            return res.status(404).json({ msg: 'Verse not found' });
        }

        res.json(verse);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
};

// @desc    Get all chapters with rich metadata
// @route   GET /api/verses/chapters
// @access  Public
exports.getChapters = async (req, res) => {
    try {
        const chapters = getChaptersMeta();
        res.json(chapters);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
};

// @desc    Get single chapter details and verses
// @route   GET /api/verses/chapters/:chapter
// @access  Public
exports.getChapterDetails = async (req, res) => {
    try {
        const chapterNum = parseInt(req.params.chapter);
        const meta = getChapterMeta(chapterNum);
        if (!meta) {
            return res.status(404).json({ msg: 'Chapter not found' });
        }
        const verses = getVerses().filter(v => v.chapter === chapterNum);
        res.json({
            ...meta,
            verses
        });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
};

// @desc    Search verses — ranked text search, or a direct verse reference ("2.47")
// @route   GET /api/verses/search?q=&limit=
// @access  Public
exports.searchVerses = async (req, res) => {
    try {
        const { q, limit = 20 } = req.query;
        if (typeof q !== 'string' || !q.trim()) {
            return res.status(400).json({ msg: 'Please provide a search query' });
        }
        if (q.length > 200) {
            return res.status(400).json({ msg: 'Search query is too long' });
        }

        const max = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 200);
        const { match, results } = searchService.searchVerses(getVerses(), q);

        res.json({
            count: results.length,
            match,
            results: results.slice(0, max)
        });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
};

// @desc    Get random verse
// @route   GET /api/verses/random
// @access  Public
exports.getRandomVerse = async (req, res) => {
    try {
        const verses = getVerses();
        if (verses.length === 0) {
            return res.status(404).json({ msg: 'No verses loaded' });
        }
        const random = Math.floor(Math.random() * verses.length);
        res.json(verses[random]);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
};

