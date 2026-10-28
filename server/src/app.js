// Builds the Express app without starting it, so Supertest can import it directly.
const express = require('express');
const cors = require('cors');
const env = require('./config/env');
const { notFound, errorHandler } = require('./middleware/errorHandler');

function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.use(cors({ origin: env.clientOrigin.split(',').map((o) => o.trim()) }));
  app.use(express.json({ limit: '100kb' }));

  app.get('/api/health', (_req, res) => res.json({ ok: true, time: new Date().toISOString() }));
  app.use('/api/auth', require('./routes/auth.routes'));
  app.use('/api/auctions', require('./routes/auction.routes'));
  app.use('/api/me', require('./routes/me.routes'));
  app.use('/api/admin', require('./routes/admin.routes'));

  app.use(notFound);
  app.use(errorHandler);
  return app;
}

module.exports = createApp();
module.exports.createApp = createApp;
