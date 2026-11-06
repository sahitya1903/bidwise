# BidWise REST API

Base URL: `/api` (server default `http://localhost:5000/api`). JSON in and out.

- Protected routes need `Authorization: Bearer <token>` (token from register or login, valid 1 day).
- **Money is always integer paise**: ₹1,100 → `110000`.
- Times are ISO 8601 strings in UTC.

## Error format

Every error uses one shape, so the UI can show `message` directly:

```http
HTTP/1.1 409 Conflict
{ "error": { "code": "BID_TOO_LOW", "message": "Minimum bid is ₹1,100", "details": { "minAllowed": 110000 } } }
```

Validation errors list each bad field:

```json
{ "error": { "code": "VALIDATION_ERROR", "message": "Starting price must be at least ₹1",
             "details": { "fields": { "startingPrice": "Starting price must be at least ₹1" } } } }
```

| Status | Meaning | Codes |
|---|---|---|
| 400 | Invalid input | `VALIDATION_ERROR` |
| 401 | Missing / invalid / expired token, or wrong login | `UNAUTHORIZED`, `INVALID_TOKEN`, `INVALID_CREDENTIALS` |
| 403 | Logged in but not allowed | `FORBIDDEN`, `NOT_OWNER`, `OWN_AUCTION` |
| 404 | Not found | `AUCTION_NOT_FOUND`, `NOT_FOUND` |
| 409 | Valid request that breaks a rule given the current state | `EMAIL_TAKEN`, `HAS_BIDS`, `AUCTION_CLOSED`, `AUCTION_NOT_ACTIVE`, `ALREADY_HIGHEST_BIDDER`, `BID_TOO_LOW`, `OUTBID_RETRY` |
| 500 | Unexpected server error | `INTERNAL_ERROR` |

## Objects

**User** — `{ id, name, email, role: "user" | "admin", createdAt }` (never includes the password hash).

**Auction**

```json
{
  "id": "6aea405f8a784f7fe43eacbc",
  "title": "Vintage Camera",
  "description": "Rangefinder, working",
  "category": "Electronics",
  "imageUrl": "https://example.com/camera.jpg",
  "seller": { "id": "…", "name": "Alice Sharma" },
  "startingPrice": 100000,
  "minIncrement": 10000,
  "currentBid": 120000,
  "highestBidder": { "id": "…", "name": "Carol Iyer" },
  "bidCount": 2,
  "startTime": "2026-11-04T09:00:00.000Z",
  "endTime": "2026-11-04T09:03:00.000Z",
  "status": "ACTIVE",
  "winner": null,
  "finalPrice": null,
  "hasReserve": true,
  "reserveMet": false,
  "minNextBid": 130000,
  "timeLeftMs": 95000,
  "createdAt": "2026-11-04T09:00:00.000Z",
  "reservePrice": 250000
}
```

`reservePrice` is included **only when the seller is the viewer**. `status` is one of `SCHEDULED`,
`ACTIVE`, `SOLD`, `UNSOLD`, `CANCELLED`. Categories: Electronics, Collectibles, Fashion, Home, Art, Books,
Sports, Vehicles, Other.

## Endpoints

### Auth

| Method | Endpoint | Auth | Body | Success | Errors |
|---|---|---|---|---|---|
| POST | `/auth/register` | — | `{ name, email, password }` (password ≥ 8 chars) | 201 `{ token, user }` | 400, 409 `EMAIL_TAKEN` |
| POST | `/auth/login` | — | `{ email, password }` | 200 `{ token, user }` | 400, 401 `INVALID_CREDENTIALS` |
| GET | `/auth/me` | User | — | 200 `{ user }` | 401 |

Logging out is done on the client by discarding the token.

### Auctions

| Method | Endpoint | Auth | Body / query | Success | Errors |
|---|---|---|---|---|---|
| GET | `/auctions` | — | `q`, `category`, `status` (`ACTIVE` default, `SCHEDULED`, `SOLD`, `UNSOLD`, `CANCELLED`, `ENDED` = sold+unsold, `ALL`), `sort` (`ending` default, `newest`, `price_asc`, `price_desc`), `page`, `limit` (max 50) | 200 `{ items, total, page, pages }` | — |
| GET | `/auctions/:id` | — | — | 200 `{ auction }` | 404 |
| POST | `/auctions` | User | `{ title, description?, category?, imageUrl?, startingPrice, reservePrice?, minIncrement, startTime?, endTime }` | 201 `{ auction }` | 400, 401 |
| PATCH | `/auctions/:id` | Owner | any subset of the create fields | 200 `{ auction }` | 400, 403 `NOT_OWNER`, 404, 409 `HAS_BIDS` / `AUCTION_CLOSED` |
| POST | `/auctions/:id/cancel` | Owner / Admin | — | 200 `{ auction }` | 403, 404, 409 `HAS_BIDS` / `AUCTION_CLOSED` |

Create rules: starting price and increment ≥ 100 paise; reserve is 0 or ≥ starting price; duration 1 minute
to 30 days; end time in the future. A missing or past `startTime` means "start now" (status `ACTIVE`); a
future one gives status `SCHEDULED`. Once an auction is `ACTIVE`, its start time cannot be changed.

### Bids

| Method | Endpoint | Auth | Body | Success | Errors |
|---|---|---|---|---|---|
| GET | `/auctions/:id/bids` | — | — | 200 `{ bids: [{ id, amount, bidder: { id, name }, createdAt }] }` highest first | 404 |
| POST | `/auctions/:id/bids` | User | `{ amount }` (positive integer paise) | 201 `{ bid, auction }` | 400, 401, 403 `OWN_AUCTION`, 404, 409 `AUCTION_NOT_ACTIVE` / `ALREADY_HIGHEST_BIDDER` / `BID_TOO_LOW` / `OUTBID_RETRY` |

`OUTBID_RETRY` means another bid was saved between reading and writing the auction; `details.minAllowed`
holds the new minimum.

### Me

| Method | Endpoint | Auth | Success |
|---|---|---|---|
| GET | `/me/bids` | User | 200 `{ items: [{ auction, myHighestBid, myBidCount, lastBidAt, bidStatus }] }` — `bidStatus` is `WINNING`, `OUTBID`, `WON`, `LOST` or `CANCELLED` |
| GET | `/me/auctions` | User | 200 `{ items: [auction] }` — every status, newest first, with `reservePrice` |

### Admin

| Method | Endpoint | Auth | Success | Errors |
|---|---|---|---|---|
| GET | `/admin/users` | Admin | 200 `{ users }` | 401, 403 `FORBIDDEN` |

Admins cancel auctions with `POST /auctions/:id/cancel`.

### Health

`GET /health` → `{ ok: true, time }`.

## Example session

```bash
B=http://localhost:5000/api
TOKEN=$(curl -s -X POST $B/auth/login -H 'Content-Type: application/json' \
  -d '{"email":"bob@bidwise.test","password":"Password1"}' | node -pe "JSON.parse(require('fs').readFileSync(0)).token")

curl -s "$B/auctions?q=keyboard"
curl -s -X POST $B/auctions/<id>/bids -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' -d '{"amount":280000}'
```
