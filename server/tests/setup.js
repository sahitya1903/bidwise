// Fresh in-memory MongoDB for every test file; collections are emptied after each test.
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

let mongo;

beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  // The MongoDB driver loads 'os' with a dynamic import(), which Jest's CommonJS sandbox
  // cannot run. Handing it the module directly avoids an empty connection handshake.
  await mongoose.connect(mongo.getUri(), { runtimeAdapters: { os: require('os') } });
  await Promise.all(Object.values(mongoose.models).map((m) => m.syncIndexes()));
});

afterEach(async () => {
  for (const c of Object.values(mongoose.connection.collections)) await c.deleteMany({});
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongo.stop();
});
