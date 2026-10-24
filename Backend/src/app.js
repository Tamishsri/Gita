require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { loadData } = require('./data/loader');

const app = express();
const PORT = process.env.PORT || 5000;

// Load Data
loadData();

const verseRoutes = require('./routes/verseRoutes');
const chatRoutes = require('./routes/chatRoutes');
const dailyRoutes = require('./routes/dailyRoutes');
const voiceRoutes = require('./routes/voiceRoutes');

// Middleware
app.disable('x-powered-by');
app.use(cors());
app.use(express.json({ limit: '32kb' }));

// Routes
app.use('/api/verses', verseRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/daily', dailyRoutes);
app.use('/api/voice', voiceRoutes);

app.get('/', (req, res) => {
    res.json({ message: 'Welcome to Project K Backend API' });
});

app.use('/api', (req, res) => {
    res.status(404).json({ msg: 'Not found' });
});

// Malformed JSON or oversized bodies arrive here instead of crashing a route.
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
    const status = err.status || err.statusCode || 500;
    if (status >= 500) console.error(err);
    res.status(status).json({ msg: status === 413 ? 'Request too large' : status === 400 ? 'Malformed request' : 'Server Error' });
});

// Start the server only when run directly, so tests can import the app.
if (require.main === module) {
    app.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
    });
}

module.exports = app;
