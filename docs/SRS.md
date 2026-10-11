# Software Requirements Specification — BidWise Online Auction System

Version 1.0 · 4 Nov 2026 · Software Engineering Project 32

## 1. Introduction

### 1.1 Purpose
This document states what the BidWise online auction system must do. It is the reference for the design
(docs/uml), the implementation (server/, client/) and the tests (docs/test-cases.md).

### 1.2 Scope
Registered users list items for auction and bid on other users' items. Each auction has a starting price,
an optional hidden reserve price, a minimum bid increment, a start time and an end time. When the end time
passes, the system closes the auction automatically; the highest bid wins if it meets the reserve.

| In scope | Out of scope (future work) |
|---|---|
| Registration, login, JWT sessions, roles (user / admin) | Real payments and shipping |
| Create, edit, cancel, browse and search auctions | Image file upload (an image URL is used instead) |
| Bidding with all business rules, safe under simultaneous bids | Email / SMS notifications |
| Automatic opening and closing of auctions, winner selection | Proxy (automatic) bidding |
| My bids / My listings pages, admin panel | WebSocket push (3-second polling is used) |
| Auction page refreshes the current bid every 3 seconds | Cloud deployment |
| Automated tests and coverage report | |

### 1.3 Definitions
- **Paise** — 1/100 of a rupee. All money is stored and sent as an integer number of paise.
- **Reserve price** — the lowest price the seller will accept; hidden from bidders. 0 means no reserve.
- **Minimum next bid** — the starting price if there are no bids, otherwise current bid + minimum increment.

## 2. Overall description

### 2.1 Actors

| Actor | Description |
|---|---|
| Guest | Visitor who is not logged in. Can browse and view auctions and register. |
| Bidder | Registered user placing bids. Any registered user can bid. |
| Seller | Registered user listing items. The same account can be a seller and a bidder. |
| Admin | Moderator who can view users and cancel any auction. |
| Scheduler | System timer that opens scheduled auctions and closes expired ones (every 15 s). |

### 2.2 Operating environment
Node.js 20+ server with MongoDB; any modern browser, desktop or phone (from 375 px wide).

## 3. Functional requirements

| ID | Requirement | Priority |
|---|---|---|
| FR-01 | A guest can register with name, email and password. | Must |
| FR-02 | A user can log in and log out. A login returns a JWT valid for 1 day. | Must |
| FR-03 | Anyone can browse active auctions, search by keyword and filter by category. | Must |
| FR-04 | The auction page shows the current bid, minimum next bid, time left and bid history. | Must |
| FR-05 | A user can create an auction: title, description, category, image URL, starting price, reserve price, minimum increment, start time and end time. | Must |
| FR-06 | A seller can edit or cancel their own auction only before the first bid. | Should |
| FR-07 | A user can place a bid that follows business rules BR-03 to BR-07. | Must |
| FR-08 | At the end time the system closes the auction and picks a winner (BR-08). | Must |
| FR-09 | A user can see their bids (winning / outbid / won / lost) and their listings with results. | Must |
| FR-10 | An admin can list users and cancel any auction that is not yet closed. | Should |
| FR-11 | The auction page refreshes the current bid automatically every 3 seconds. | Should |

## 4. Business rules

| ID | Rule | Enforced in |
|---|---|---|
| BR-01 | Starting price ≥ ₹1, minimum increment ≥ ₹1, and reserve price is either 0 (no reserve) or ≥ starting price. | `utils/validation.js` (createAuctionSchema) |
| BR-02 | End time must be after start time. Duration is between 1 minute and 30 days. | `utils/validation.js`, `auctionService.create/update` |
| BR-03 | The first bid must be ≥ the starting price. | `Auction.minNextBid()`, `biddingService.placeBid` |
| BR-04 | Every later bid must be ≥ current bid + minimum increment. | same |
| BR-05 | A seller cannot bid on their own auction. | `biddingService.placeBid` |
| BR-06 | Bids are accepted only while the status is ACTIVE and the current time is before the end time. | `Auction.isOpenAt()`, compare-and-set filter |
| BR-07 | The current highest bidder cannot outbid themselves. | `biddingService.placeBid` |
| BR-08 | At the end time: if there is at least one bid and the top bid ≥ reserve, the status becomes SOLD and the winner and final price are recorded. Otherwise UNSOLD. | `closingService.closeExpired` |
| BR-09 | A seller may edit or cancel only before the first bid. An admin may cancel any auction before it closes. | `auctionService.update/cancel` |
| BR-10 | Bids are never edited or deleted. They form the audit trail. | `models/Bid.js` (update/delete hooks throw) |

## 5. Non-functional requirements

| ID | Category | Requirement | How it is met |
|---|---|---|---|
| NFR-01 | Security | Passwords hashed with bcrypt and never returned. Protected routes need a valid JWT. All input validated on the server. | bcryptjs; `User.toJSON` removes the hash; `requireAuth`; zod schemas |
| NFR-02 | Consistency | Two simultaneous bids can never both succeed against the same auction state. | Compare-and-set on `bidCount` (TC-29) |
| NFR-03 | Performance | Bid and page requests respond in under 500 ms locally. | Indexed queries; denormalised `currentBid` / `bidCount` on the auction |
| NFR-04 | Usability | Clear error messages (e.g. "Minimum bid is ₹1,100"). Works on a 375 px phone. | Error messages from the API shown directly; responsive CSS |
| NFR-05 | Maintainability | Layered modules, one responsibility each, ESLint + Prettier, README. | See README and architecture diagram |
| NFR-06 | Testability | ≥ 80% line coverage on services/. All tests run with one command. | `npm test` / `npm run test:cov` (≈97% on services) |
| NFR-07 | Reliability | The closing job can run again safely. Times stored in UTC. | Updates filter on `status: 'ACTIVE'` (TC-35); MongoDB Dates are UTC |

## 6. Use cases

| ID | Use case | Actor(s) | Requirement |
|---|---|---|---|
| UC-01 | Register | Guest | FR-01 |
| UC-02 | Log in / out | Bidder, Seller, Admin | FR-02 |
| UC-03 | Browse & search auctions | Guest, Bidder | FR-03 |
| UC-04 | View auction details | Guest, Bidder | FR-04, FR-11 |
| UC-05 | Place bid | Bidder | FR-07 |
| UC-06 | View my bids | Bidder | FR-09 |
| UC-07 | Create auction | Seller | FR-05 |
| UC-08 | Edit / cancel own auction | Seller | FR-06 |
| UC-09 | View my listings & results | Seller | FR-09 |
| UC-10 | Manage users | Admin | FR-10 |
| UC-11 | Cancel any auction | Admin | FR-10 |
| UC-12 | Close auction & pick winner | Scheduler | FR-08 |

### 6.1 Detailed use case UC-05 — Place bid

| Field | Description |
|---|---|
| Primary actor | Bidder |
| Preconditions | The bidder is logged in. The auction is ACTIVE and its end time has not passed. |
| Trigger | The bidder types an amount on the auction page and clicks **Place bid**. |
| Main flow | 1. The system shows the current bid and the minimum next bid. 2. The bidder enters an amount ≥ the minimum and submits. 3. The system validates the input and checks BR-03 to BR-07. 4. The system saves the bid atomically and updates the current bid and highest bidder. 5. The system confirms. Other viewers see the new bid within 3 seconds. |
| Alternate flows | 3a. Amount below the minimum → rejected; the message shows the minimum allowed. 3b. Bidder is the seller → rejected (403). 3c. Auction ended or cancelled → rejected; the page shows the final status. 3d. Bidder is already the highest bidder → rejected. 4a. Another bid was saved first (race) → rejected with "You were outbid — new minimum is …". |
| Postconditions | A Bid document exists. The auction's currentBid = amount, highestBidder = bidder, bidCount + 1. |
| Business rules | BR-03, BR-04, BR-05, BR-06, BR-07, BR-10 |

## 7. Traceability matrix

| Requirement | Use case | Module(s) | Test cases |
|---|---|---|---|
| FR-01 Register | UC-01 | authService, auth.routes | TC-01 – TC-04 |
| FR-02 Login / JWT | UC-02 | authService, middleware/auth | TC-05 – TC-08 |
| FR-03 Browse / search | UC-03 | auctionService.list | TC-15 |
| FR-04 Auction details | UC-04 | auctionService.getById, BidHistory, Countdown | TC-30, TC-37, TC-38 |
| FR-05 Create auction | UC-07 | auctionService.create, validation | TC-09 – TC-14 |
| FR-06 Edit / cancel | UC-08 | auctionService.update / cancel | TC-16 – TC-18 |
| FR-07 Place bid | UC-05 | biddingService.placeBid | TC-19 – TC-29 |
| FR-08 Close auction | UC-12 | closingService, jobs/auctionCloser | TC-31 – TC-35, M-02 |
| FR-09 My bids / listings | UC-06, UC-09 | biddingService.getUserBids, auctionService.listBySeller | TC-36 |
| FR-10 Admin | UC-10, UC-11 | adminController, requireRole, auctionService.cancel | TC-08, TC-18 |
| FR-11 Auto refresh | UC-04 | AuctionDetail (3 s polling) | M-01 |
