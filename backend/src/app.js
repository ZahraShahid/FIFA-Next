'use strict';

const express = require('express');
const cors = require('cors');

const {
  createAnalysis,
  getAnalysis,
  queue,
} = require('./controllers/analysis.controller');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', uptime: process.uptime() });
});

app.post('/analysis', createAnalysis);
app.get('/analysis/:id', getAnalysis);

app.use((req, res) => {
  res.status(404).json({
    error: 'NotFound',
    message: `Route ${req.method} ${req.originalUrl} does not exist.`,
  });
});

// Express treats a 4-arg middleware as the error handler.
// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  console.error('[Unhandled error]', err);
  res.status(500).json({
    error: 'InternalServerError',
    message: 'An unexpected error occurred while processing the request.',
  });
});

if (require.main === module) {
  const server = app.listen(PORT, () => {
    console.log(`FIFA Next backend listening on http://localhost:${PORT}`);
  });

  const shutdown = (signal) => {
    console.log(`\n${signal} received, shutting down...`);
    queue.shutdown();
    server.close(() => process.exit(0));
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

module.exports = app;
