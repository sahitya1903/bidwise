const bcrypt = require('bcryptjs');
const User = require('../src/models/User');
const auctionService = require('../src/services/auctionService');
const { signToken } = require('../src/services/authService');

const PASSWORD = 'Password1';
let passwordHash;
let counter = 0;

async function makeUser({ name, role = 'user', email } = {}) {
  passwordHash ??= await bcrypt.hash(PASSWORD, 4);
  counter += 1;
  const n = name || `User${counter}`;
  const user = await User.create({
    name: n,
    email: email || `${n.toLowerCase()}${counter}@test.dev`,
    passwordHash,
    role,
  });
  return Object.assign(user, { token: signToken(user) });
}

// Creates alice (seller), bob and carol (bidders) and one auction by alice.
// Prices are in paise. endsInMs / startsInMs are relative to `now`.
async function makeAuction({
  startingPrice = 100000,
  reservePrice = 0,
  minIncrement = 10000,
  endsInMs = 60 * 60 * 1000,
  startsInMs = 0,
  title = 'Test item',
  description = 'A test auction',
  category = 'Other',
  now = new Date(),
  seller,
} = {}) {
  const alice = seller || (await makeUser({ name: 'Alice' }));
  const bob = await makeUser({ name: 'Bob' });
  const carol = await makeUser({ name: 'Carol' });
  const startTime = new Date(now.getTime() + startsInMs);
  const auction = await auctionService.create({
    sellerId: alice._id,
    now,
    data: {
      title,
      description,
      category,
      startingPrice,
      reservePrice,
      minIncrement,
      startTime,
      endTime: new Date(startTime.getTime() + endsInMs),
    },
  });
  return { auction, alice, bob, carol, now };
}

const auth = (user) => ({ Authorization: `Bearer ${user.token}` });

module.exports = { makeUser, makeAuction, auth, PASSWORD };
