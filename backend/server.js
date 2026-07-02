const dns = require('dns');
dns.setDefaultResultOrder('ipv4first');

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const path = require('path');
const passport = require('passport');

const app = express();

const { initTable: initDynamoDBTable } = require('./config/dynamodb');

initDynamoDBTable().catch((err) => console.warn('DynamoDB init warning:', err.message));

app.use(helmet({ crossOriginResourcePolicy: false }));
app.use(morgan('dev'));
app.use(cors({ origin: process.env.CLIENT_URL || 'http://localhost:3000', credentials: true }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(passport.initialize());

app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use('/api/storage', require('./routes/storage'));
app.use('/api/storage', express.static(path.join(__dirname, 'storage')));

app.use('/api/interview/create', rateLimit({ windowMs: 15 * 60 * 1000, max: 10 }));
app.use('/api/payment', rateLimit({ windowMs: 15 * 60 * 1000, max: 20 }));

app.use('/api/auth', require('./routes/auth'));
app.use('/api/interview', require('./routes/interview'));
app.use('/api/payment', require('./routes/payment'));
app.use('/api/feedback', require('./routes/feedback'));
app.use('/api/resume', require('./routes/resume'));
app.use('/api/livekit', require('./routes/livekit'));

require('./services/recordingCleanup').startCleanupCron();

app.get('/api/health', (req, res) => res.json({ success: true, message: 'MockMate API is running', timestamp: new Date() }));

app.use((req, res) => res.status(404).json({ success: false, message: `Route ${req.originalUrl} not found.` }));
app.use((err, req, res, next) => {
  console.error(err.stack || err);
  res.status(500).json({ success: false, message: 'Server error' });
});

const PORT = process.env.PORT || 5000;
const server = app.listen(PORT, () => console.log(`Server running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`));

process.on('unhandledRejection', (err) => console.error('Unhandled:', err));
process.on('uncaughtException', (err) => console.error('Uncaught:', err));

module.exports = app;
module.exports.server = server;
