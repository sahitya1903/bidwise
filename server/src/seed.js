// npm run seed — wipes the database and loads demo users and auctions.
// DEMO_END_MINUTES sets how soon the "ending soon" auction closes (default 10).
const bcrypt = require('bcryptjs');
const env = require('./config/env');
const { connectDB, disconnectDB } = require('./config/db');
const User = require('./models/User');
const Auction = require('./models/Auction');
const Bid = require('./models/Bid');

const PASSWORD = 'Password1';
const MIN = 60 * 1000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;
const rs = (rupees) => rupees * 100; // rupees → paise

async function seed() {
  await connectDB();
  // Bid documents are immutable through Mongoose, so clear collections with the raw driver.
  await Promise.all([
    User.collection.deleteMany({}),
    Auction.collection.deleteMany({}),
    Bid.collection.deleteMany({}),
  ]);
  await Promise.all([User.syncIndexes(), Auction.syncIndexes(), Bid.syncIndexes()]);

  const passwordHash = await bcrypt.hash(PASSWORD, 10);
  const [alice, bob, carol, admin] = await User.create([
    { name: 'Alice Sharma', email: 'alice@bidwise.test', passwordHash },
    { name: 'Bob Mehta', email: 'bob@bidwise.test', passwordHash },
    { name: 'Carol Iyer', email: 'carol@bidwise.test', passwordHash },
    { name: 'Site Admin', email: 'admin@bidwise.test', passwordHash, role: 'admin' },
  ]);

  const now = Date.now();
  const demoMinutes = Number(process.env.DEMO_END_MINUTES) || 10;

  // Each entry: auction fields + bids in order [bidder, rupees].
  const plan = [
    {
      title: 'Antique Brass Pocket Watch',
      description: 'Working 1950s mechanical pocket watch with chain. Ends during the demo.',
      category: 'Collectibles',
      imageUrl: '',
      seller: alice,
      startingPrice: rs(1500),
      reservePrice: rs(2000),
      minIncrement: rs(100),
      startTime: new Date(now - HOUR),
      endTime: new Date(now + demoMinutes * MIN),
      bids: [
        [bob, 1500],
        [carol, 1700],
        [bob, 2100],
      ],
    },
    {
      title: 'Mechanical Keyboard (Brown Switches)',
      description: 'Tenkeyless keyboard, PBT keycaps, USB-C. Lightly used.',
      category: 'Electronics',
      imageUrl: '',
      seller: alice,
      startingPrice: rs(2500),
      reservePrice: 0,
      minIncrement: rs(100),
      startTime: new Date(now - DAY),
      endTime: new Date(now + 2 * HOUR),
      bids: [
        [carol, 2500],
        [bob, 2700],
      ],
    },
    {
      title: 'Signed Cricket Bat',
      description: 'Full-size English willow bat signed by the 2011 squad. Certificate included.',
      category: 'Sports',
      imageUrl: '',
      seller: bob,
      startingPrice: rs(5000),
      reservePrice: rs(8000),
      minIncrement: rs(250),
      startTime: new Date(now - 3 * HOUR),
      endTime: new Date(now + DAY),
      bids: [[carol, 5000]],
    },
    {
      title: 'Watercolour Landscape, Framed',
      description: 'Original painting of the Western Ghats, 40 × 30 cm, wooden frame.',
      category: 'Art',
      imageUrl: '',
      seller: carol,
      startingPrice: rs(1200),
      reservePrice: 0,
      minIncrement: rs(50),
      startTime: new Date(now - 2 * HOUR),
      endTime: new Date(now + 3 * DAY),
      bids: [],
    },
    {
      title: 'Vintage Film Camera',
      description: 'Classic 35 mm rangefinder. Goes live in 30 minutes.',
      category: 'Electronics',
      imageUrl: '',
      seller: alice,
      startingPrice: rs(3000),
      reservePrice: rs(4000),
      minIncrement: rs(100),
      startTime: new Date(now + 30 * MIN),
      endTime: new Date(now + 2 * DAY),
      status: 'SCHEDULED',
      bids: [],
    },
    {
      title: 'First-Edition Novel Set',
      description: 'Box set of three hardcover first editions. Already sold.',
      category: 'Books',
      imageUrl: '',
      seller: carol,
      startingPrice: rs(800),
      reservePrice: rs(1000),
      minIncrement: rs(50),
      startTime: new Date(now - 3 * DAY),
      endTime: new Date(now - DAY),
      bids: [
        [bob, 800],
        [alice, 900],
        [bob, 1150],
      ],
      closeAs: 'SOLD',
    },
  ];

  for (const item of plan) {
    const { bids, closeAs, ...fields } = item;
    const auction = await Auction.create({ ...fields, status: fields.status || 'ACTIVE' });
    let t = fields.startTime.getTime() + 5 * MIN;
    for (const [bidder, rupees] of bids) {
      t += 7 * MIN;
      await Bid.create({
        auction: auction._id,
        bidder: bidder._id,
        amount: rs(rupees),
        createdAt: new Date(t),
      });
      auction.currentBid = rs(rupees);
      auction.highestBidder = bidder._id;
      auction.bidCount += 1;
    }
    if (closeAs === 'SOLD') {
      auction.status = 'SOLD';
      auction.winner = auction.highestBidder;
      auction.finalPrice = auction.currentBid;
    }
    await auction.save();
  }

  console.log(`Seeded ${plan.length} auctions into ${env.mongoUri}`);
  console.log(`Demo accounts (password "${PASSWORD}"):`);
  for (const u of [alice, bob, carol, admin]) console.log(`  ${u.email.padEnd(22)} ${u.role}`);
  console.log(`"${plan[0].title}" ends in ${demoMinutes} minute(s).`);
}

seed()
  .catch((err) => {
    console.error('Seed failed:', err);
    process.exitCode = 1;
  })
  .finally(() => disconnectDB());
