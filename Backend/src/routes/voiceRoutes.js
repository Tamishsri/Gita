const express = require('express');
const router = express.Router();
const voiceController = require('../controllers/voiceController');

router.get('/', voiceController.status);
router.get('/:id', voiceController.recite);

module.exports = router;
