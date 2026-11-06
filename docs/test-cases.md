# Test cases and results

Run on 4 Nov 2026 · Node.js 26 · Windows 11.

| Suite | Command | Result |
|---|---|---|
| Server unit + integration (Jest, in-memory MongoDB) | `cd server && npm run test:cov` | **80 / 80 passed** · lines: services 96.8%, overall 95.7% |
| Client components (Vitest + React Testing Library) | `cd client && npm test` | **10 / 10 passed** |

Every planned case TC-01 … TC-38 is automated; the test name starts with its ID (`npx jest -t "TC-22"`).
The suites also contain extra tests beyond the plan (edit/cancel rules, model helpers, the closing job,
ten simultaneous bids, bid immutability, error format), which is why the totals are higher than 38.

**Levels:** U = unit (service called directly), I = integration (HTTP through Supertest), C = component.
**Techniques:** EP equivalence partitioning · BVA boundary value analysis · ST state transition ·
DT decision table · NEG negative/security · CON concurrency. Amounts are in rupees for readability
(stored as paise).

## Automated test cases

| ID | Area | Scenario / input | Expected result | Actual result | Tech. | Lvl | Pass/Fail |
|---|---|---|---|---|---|---|---|
| TC-01 | Auth | Register with valid name, email, 8+ char password | 201; user saved; no passwordHash in response | 201, token + user, no `passwordHash` anywhere in body | EP | I | Pass |
| TC-02 | Auth | Register with an email that already exists | 409 EMAIL_TAKEN | 409 EMAIL_TAKEN (also with different letter case) | EP | I | Pass |
| TC-03 | Auth | Password of 7 characters | 400 validation error | 400 VALIDATION_ERROR | BVA | U | Pass |
| TC-04 | Auth | Password of exactly 8 characters | Accepted | Account created, token returned | BVA | U | Pass |
| TC-05 | Auth | Login with correct credentials | 200 with JWT and user | 200 `{ token, user }`; token works on `/auth/me` | EP | I | Pass |
| TC-06 | Auth | Login with wrong password | 401 INVALID_CREDENTIALS | 401 INVALID_CREDENTIALS | NEG | I | Pass |
| TC-07 | Auth | Call POST /auctions without a token (also POST /bids — TC-07b) | 401 | 401 UNAUTHORIZED for both | NEG | I | Pass |
| TC-08 | Auth | Normal user calls GET /admin/users | 403 | 403 FORBIDDEN; admin gets 200 | NEG | I | Pass |
| TC-09 | Auction | Create valid auction starting now | 201; status ACTIVE | 201, ACTIVE, minNextBid = starting price | EP | I | Pass |
| TC-10 | Auction | Starting price ₹0 | 400 | 400 VALIDATION_ERROR | BVA | U | Pass |
| TC-11 | Auction | Starting price ₹1 (smallest valid) | Created | Created, ACTIVE | BVA | U | Pass |
| TC-12 | Auction | Reserve price lower than starting price | 400 | 400 with `fields.reservePrice` | EP | U | Pass |
| TC-13 | Auction | End time equal to or before start time | 400 | 400 "End time must be after the start time" (both cases) | BVA | U | Pass |
| TC-14 | Auction | Start time in the future | Status SCHEDULED | SCHEDULED | ST | U | Pass |
| TC-15 | Auction | GET /auctions?q=camera | Only ACTIVE auctions matching "camera" | Only the ACTIVE match; scheduled and cancelled matches excluded | EP | I | Pass |
| TC-16 | Auction | Seller edits title before any bid | 200; title changed | 200, new title; other user 403 | ST | I | Pass |
| TC-17 | Auction | Seller edits after one bid | 409 HAS_BIDS | 409 HAS_BIDS | ST | U | Pass |
| TC-18 | Auction | Admin cancels active auction; another user tries the same | Admin: CANCELLED; other user: 403 | Other user 403; admin 200 CANCELLED; second cancel 409 | NEG | I | Pass |
| TC-19 | Bidding | First bid = starting price (₹1,000) | Accepted; currentBid ₹1,000 | Accepted, currentBid 100000, bidCount 1 | BVA | U | Pass |
| TC-20 | Bidding | First bid = ₹999.99 | 409 BID_TOO_LOW, minAllowed ₹1,000 | 409 BID_TOO_LOW, minAllowed 100000, "Minimum bid is ₹1,000" | BVA | U | Pass |
| TC-21 | Bidding | Current ₹1,000, increment ₹100, bid ₹1,100 | Accepted | Accepted, currentBid 110000 | BVA | U | Pass |
| TC-22 | Bidding | Same as TC-21 but bid ₹1,099.99 | 409 BID_TOO_LOW | 409 BID_TOO_LOW, "Minimum bid is ₹1,100" | BVA | U | Pass |
| TC-23 | Bidding | Seller bids on own auction | 403 OWN_AUCTION | 403 OWN_AUCTION | NEG | U | Pass |
| TC-24 | Bidding | Highest bidder bids again | 409 ALREADY_HIGHEST_BIDDER | 409 ALREADY_HIGHEST_BIDDER | EP | U | Pass |
| TC-25 | Bidding | Bid 1 second after end time (before the job runs) | 409 AUCTION_NOT_ACTIVE | 409 AUCTION_NOT_ACTIVE while status is still ACTIVE | BVA | U | Pass |
| TC-26 | Bidding | Bid on a CANCELLED auction | 409 AUCTION_NOT_ACTIVE | 409 AUCTION_NOT_ACTIVE | ST | U | Pass |
| TC-27 | Bidding | Bid on a non-existent auction id | 404 | 404 AUCTION_NOT_FOUND | NEG | I | Pass |
| TC-28 | Bidding | Amount negative, text, or missing | 400 | 400 VALIDATION_ERROR for all (plus fractional paise) | EP | I | Pass |
| TC-29 | Bidding | Two users bid the same valid amount at the same moment | Exactly one accepted, one 409 | One fulfilled, one 409; bidCount 1; one Bid document. TC-29b: 10 simultaneous bids → 1 accepted | CON | U | Pass |
| TC-30 | Bidding | GET /auctions/:id/bids after 3 bids | Sorted highest first; bidder names, no emails | ₹1,250 → ₹1,100 → ₹1,000; names only, no emails | EP | I | Pass |
| TC-31 | Closing | Expired auction with no bids (DT R1) | UNSOLD; no winner | UNSOLD, winner null, finalPrice null | DT | U | Pass |
| TC-32 | Closing | Top bid ₹2,000, reserve ₹2,500 (DT R2) | UNSOLD | UNSOLD, winner null | DT | U | Pass |
| TC-33 | Closing | Top bid ₹2,600, reserve ₹2,500 (DT R3) | SOLD; winner and finalPrice set | SOLD, winner = bidder, finalPrice 260000 | DT | U | Pass |
| TC-34 | Closing | SCHEDULED auction when start time passes | Becomes ACTIVE | Not activated before start; ACTIVE after | ST | U | Pass |
| TC-35 | Closing | Run closeExpired twice | Second run changes nothing | Second run: 0 changes; document identical | ST | U | Pass |
| TC-36 | My bids | User outbid on A, leading on B, won C, lost D | OUTBID, WINNING, WON, LOST | OUTBID, WINNING, WON, LOST | EP | I | Pass |
| TC-37 | UI | BidForm with min ₹1,100; type 1,050 | Submit disabled; shows "Minimum ₹1,100" | Button disabled; hint "Minimum ₹1,100" shown as error | BVA | C | Pass |
| TC-38 | UI | Countdown with end time in the past | Shows "Ended" | Shows "Ended" | BVA | C | Pass |

### Decision table for closing an auction (BR-08)

| Rule | R1 | R2 | R3 |
|---|---|---|---|
| At least one bid? | No | Yes | Yes |
| Top bid ≥ reserve? | — | No | Yes |
| Final status | UNSOLD | UNSOLD | SOLD |
| Winner / final price set? | No | No | Yes |
| Covered by | TC-31 | TC-32 | TC-33 |

## Manual test checklist

Run these in the browser before the presentation and fill in the last two columns.

| ID | Steps | Expected | Actual result | Pass/Fail |
|---|---|---|---|---|
| M-01 | Open the same auction in two browsers (normal + private). Bid in one. | The other shows the new bid within 3 s | | |
| M-02 | Watch an auction reach its end time (e.g. the seeded pocket watch) | Page switches to SOLD / UNSOLD within ~15 s, without a reload | | |
| M-03 | Logged out, open an auction and click **Log in to bid** | Redirected to login, then back to the auction | | |
| M-04 | Create an auction with end time before start time | Inline error; nothing saved | | |
| M-05 | Resize to 375 px wide | All pages usable, no horizontal scrolling | | |
