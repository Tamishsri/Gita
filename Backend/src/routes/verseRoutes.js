const express = require('express');
const router = express.Router();
const verseController = require('../controllers/verseController');

router.get('/', verseController.getVerses);
router.get('/chapters', verseController.getChapters);
router.get('/chapters/:chapter', verseController.getChapterDetails);
router.get('/search', verseController.searchVerses);
router.get('/random', verseController.getRandomVerse);
router.get('/:id', verseController.getVerseById);

module.exports = router;
