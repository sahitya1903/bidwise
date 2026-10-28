// Entry point: connect to MongoDB, start the closing job, listen for HTTP.
const env = require('./config/env');
const { connectDB } = require('./config/db');
const app = require('./app');
const closer = require('./jobs/auctionCloser');

async function main() {
  await connectDB();
  console.log(`[db] connected to ${env.mongoUri.replace(/\/\/[^@]*@/, '//***@')}`);
  closer.start(env.closerIntervalMs);
  app.listen(env.port, () => {
    console.log(`[api] listening on http://localhost:${env.port}`);
  });
}

main().catch((err) => {
  console.error('Failed to start server:', err.message);
  process.exit(1);
});
