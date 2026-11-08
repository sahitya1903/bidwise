# BidWise — Online Auction System

A full-stack online auction website (MERN). Users list items and bid on each other's items. Auctions open
and close automatically, and the highest bid that meets the hidden reserve price wins.

Software Engineering course · Project 32.

| | |
|---|---|
| **Stack** | MongoDB · Express 5 + Node.js · React 19 + Vite · Mongoose · Zod · JWT |
| **Tests** | Jest + Supertest + mongodb-memory-server (server) · Vitest + React Testing Library (client) |
| **Docs** | [SRS](docs/SRS.md) · [API](docs/api.md) · [Test cases](docs/test-cases.md) · [UML sources](docs/uml/) · [Project plan (PDF)](docs/Online-Auction-System-Project-Plan.pdf) |

## Features

- Register, log in, JWT sessions (1 day), roles `user` and `admin`.
- Browse live, upcoming and ended auctions; search by keyword; filter by category; sort; paginate.
- Create auctions with starting price, optional hidden reserve, minimum increment, start and end time.
  Start "right away" or schedule for later. A 3-minute duration is available for demos.
- Bidding with every business rule enforced on the server (BR-03 to BR-07), safe when two people bid at
  the same moment (compare-and-set update).
- Auction page refreshes every 3 seconds; a countdown ticks every second.
- A background job opens scheduled auctions and closes expired ones (SOLD / UNSOLD) every 15 seconds.
- My bids (Winning / Outbid / Won / Lost), My listings with results, Admin panel (users + cancel any auction).
- Sellers can edit or cancel their auction only until the first bid.
- Layout works down to a 375 px phone screen.

## Project structure

```
bidwise/
├── server/                 Express API
│   ├── src/
│   │   ├── config/         env.js, db.js
│   │   ├── models/         User, Auction, Bid (Mongoose schemas + indexes)
│   │   ├── services/       authService, auctionService, biddingService, closingService  ← all business rules
│   │   ├── controllers/    read request → call one service → send response
│   │   ├── routes/         /api/auth, /api/auctions, /api/me, /api/admin
│   │   ├── middleware/     auth (JWT), requireRole, validate (zod), errorHandler
│   │   ├── jobs/           auctionCloser (timer → closingService)
│   │   ├── utils/          AppError, money, validation schemas
│   │   ├── app.js          builds the Express app (no listen) — imported by tests
│   │   ├── server.js       connects to MongoDB, starts the job, listens
│   │   └── seed.js         demo users and auctions
│   └── tests/              unit/ (services) and integration/ (HTTP) + setup.js, helpers.js
├── client/                 React UI (Vite)
│   └── src/  api/  context/  components/  pages/  utils/  __tests__/
└── docs/                   SRS, API, test cases, UML sources, project plan
```

## Setup

You need **Node.js 20+** and **MongoDB** (Docker is easiest).

```bash
# 1) Database (skip if a MongoDB is already running on port 27017)
docker run -d --name auction-mongo -p 27017:27017 mongo:8
#   next time: docker start auction-mongo

# 2) Install everything (root, server, client)
npm run install:all

# 3) Configure and seed the server
cp server/.env.example server/.env   # then set JWT_SECRET to a long random string
npm run seed                         # demo data (wipes the "auction" database)

# 4) Start API (:5000) and UI (:5173) together
npm run dev                          # open http://localhost:5173 — Ctrl+C stops both
```

`npm run dev` uses [concurrently](https://www.npmjs.com/package/concurrently); output is prefixed `[api]`
and `[web]`. To run them separately instead: `npm run server` and `npm run client` in two terminals.

Settings live in `server/.env` (see [`.env.example`](server/.env.example)): `PORT`, `MONGO_URI`, `JWT_SECRET`,
`JWT_EXPIRES_IN`, `CLOSER_INTERVAL_MS`, `CLIENT_ORIGIN`.

### Demo accounts

`npm run seed` creates these accounts. The password for all of them is **`Password1`**.

| Email | Role | Notes |
|---|---|---|
| alice@bidwise.test | user | Seller of most demo items |
| bob@bidwise.test | user | Bidder |
| carol@bidwise.test | user | Bidder |
| admin@bidwise.test | admin | Can see users and cancel any auction |

The seed adds six auctions: one that **ends 10 minutes after seeding** (it will close as SOLD — set
`DEMO_END_MINUTES` to change the delay), three more live ones, one scheduled to start in 30 minutes, and
one already sold. The login page has one-click buttons that fill in the demo accounts.

## Tests

```bash
cd server
npm test              # 80 Jest tests: unit (services) + integration (HTTP), in-memory MongoDB
npm run test:cov      # same, with coverage report → coverage/lcov-report/index.html
npm run lint

cd client
npm test              # 10 Vitest component tests (BidForm, Countdown, money helpers)
```

Or from the project root: `npm test` runs both suites.

The first server test run downloads a MongoDB binary (~100 MB) for mongodb-memory-server; later runs use
the cache. Current coverage: **~97% of lines in `services/`**, ~95% overall (thresholds: 80% / 70%).

Test case IDs (TC-01 … TC-38) appear in the test names, so `npx jest -t "TC-29"` runs one case. The full
list with results is in [docs/test-cases.md](docs/test-cases.md).

## API in one table

Base URL `/api`. Money is always **integer paise** (₹1,100 → `110000`). Full details: [docs/api.md](docs/api.md).

| Method | Endpoint | Auth | Purpose |
|---|---|---|---|
| POST | /auth/register | — | Create account → `{ token, user }` |
| POST | /auth/login | — | Log in → `{ token, user }` |
| GET | /auth/me | User | Current user |
| GET | /auctions | — | List / search (`q`, `category`, `status`, `sort`, `page`) |
| GET | /auctions/:id | — | Details incl. `minNextBid`, `timeLeftMs` |
| POST | /auctions | User | Create auction |
| PATCH | /auctions/:id | Owner | Edit (before first bid) |
| POST | /auctions/:id/cancel | Owner / Admin | Cancel |
| GET | /auctions/:id/bids | — | Bid history, highest first |
| POST | /auctions/:id/bids | User | Place bid `{ amount }` |
| GET | /me/bids | User | My bids with WINNING / OUTBID / WON / LOST |
| GET | /me/auctions | User | My listings |
| GET | /admin/users | Admin | List users |

Every error has the same shape:

```json
{ "error": { "code": "BID_TOO_LOW", "message": "Minimum bid is ₹1,100", "details": { "minAllowed": 110000 } } }
```

## Design notes

- **Layered backend.** routes → middleware → controllers → services → models. Only the services know the
  business rules, so they are tested directly, and the closing job reuses them.
- **Safe concurrent bids (NFR-02).** `placeBid` reads the auction, checks the rules, then updates with a
  filter on the `bidCount` it read. If someone else bid in between, the update matches nothing and the
  second bidder gets `409 OUTBID_RETRY` with the new minimum. Test TC-29 fires simultaneous bids to prove it.
- **Injectable time.** Services take a `now` argument, so tests jump past end times instead of waiting.
- **Idempotent closing (NFR-07).** Each close filters on `status: 'ACTIVE'`, so running the job twice
  changes nothing the second time (TC-35).
- **Money in paise.** Integers avoid floating-point errors; the UI converts only for display and input.
- **Bids are immutable (BR-10).** The Bid model refuses update and delete operations.
- **Reserve price is private.** Only the seller sees it; others see "Met" / "Not met yet".

## Demo script (3 minutes)

1. `npm run seed` about 10 minutes before presenting (starts the clock on the "ending soon" auction), then
   start server and client. Log in as **alice** (normal window), **bob** (private window), **carol** (another browser).
2. Alice → **Sell**: "Vintage Camera", start ₹1,000, reserve ₹2,500, increment ₹100, duration 3 minutes.
3. Bob opens it and bids ₹1,000 → accepted. Carol's screen updates within 3 s.
4. Carol types ₹1,050 → button disabled, "Minimum ₹1,100" (BR-04, TC-22/TC-37).
5. Alice opens her own camera → no bid form: "you cannot bid on it" (BR-05).
6. Carol bids ₹1,200; Bob bids ₹2,600.
7. Open the seeded "Antique Brass Pocket Watch" → it flips to **SOLD** with the winner shown.
8. Terminal: `npm run test:cov` → all green + coverage table.

## Notes for development

- The Jest setup passes `runtimeAdapters: { os }` to `mongoose.connect`. The MongoDB driver (v7) loads
  `os` with a dynamic `import()`, which Jest's CommonJS sandbox cannot run; without this the connection
  handshake is empty and the server rejects it. Production code is unaffected.
- `npm run format` (server) applies Prettier with the root [`.prettierrc`](.prettierrc).
