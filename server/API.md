# SpendWise API

All transaction endpoints require:

```http
Authorization: Bearer <jwt>
```

## Account

### Get current profile

```http
GET /api/auth/me
```

### Update current profile

```http
PATCH /api/auth/me
Content-Type: application/json
```

```json
{
  "name": "Updated Name",
  "email": "updated@example.com"
}
```

### Change password

```http
POST /api/auth/me/password
Content-Type: application/json
```

```json
{
  "currentPassword": "current-password",
  "newPassword": "new-password",
  "confirmPassword": "new-password"
}
```

Password hashes are never returned by these endpoints.
   
## Transactions

### Create

```http
POST /api/transactions
Content-Type: application/json
```

```json
{
  "type": "expense",
  "amount": 425.5,
  "category": "Food",
  "description": "Lunch",
  "date": "2026-10-31T00:00:00.000Z"
}
```

Response: `201 Created`

```json
{
  "success": true,
  "data": {
    "transaction": {
      "id": "transaction-id",
      "userId": "user-id",
      "type": "expense",
      "amount": 425.5,
      "category": "Food",
      "description": "Lunch",
      "date": "2026-10-31T00:00:00.000Z"
    }
  }
}
```

### List and filter

```http
GET /api/transactions?type=expense&category=Food&from=2026-10-01&to=2026-10-31&page=1&limit=20
```

`limit` defaults to `20` and cannot exceed `50`.

Response: `200 OK`

```json
{
  "success": true,
  "data": {
    "items": [],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 0,
      "totalPages": 0
    }
  }
}
```

### Get one

```http
GET /api/transactions/:id
```

### Update

```http
PATCH /api/transactions/:id
Content-Type: application/json
```

```json
{
  "amount": 500,
  "description": "Updated description"
}
```

Response: `200 OK`, with the updated transaction.

### Delete

```http
DELETE /api/transactions/:id
```

Response: `204 No Content`.

Invalid input returns `400`, missing or cross-user records return `404`, and missing or invalid JWTs return `401`.

## Budgets

Budgets use a UTC calendar period represented by `year` and `month` (`1` through `12`).
Each user can have one budget per category and month.

```http
POST /api/budgets
Authorization: Bearer <jwt>
Content-Type: application/json
```

```json
{
  "category": "Food",
  "year": 2026,
  "month": 10,
  "monthlyLimit": 10000
}
```

Budget responses include server-calculated `spent`, `remaining`, and
`usagePercentage` values. Duplicate category/month budgets return `409`.

```http
GET /api/budgets?year=2026&month=10
PATCH /api/budgets/:id
DELETE /api/budgets/:id
```

## Monthly analytics

```http
GET /api/analytics/monthly?year=2026&month=10
Authorization: Bearer <jwt>
```

The backend calculates these values from the authenticated user's transactions:

```json
{
  "success": true,
  "data": {
    "period": { "year": 2026, "month": 10 },
    "income": 50000,
    "expenses": 12500,
    "netSavings": 37500,
    "categorySpending": [
      { "category": "Food", "amount": 5000 }
    ]
  }
}
```

## Spending insights

```http
POST /api/insights/spending-summary
Authorization: Bearer <jwt>
Content-Type: application/json
```

```json
{
  "year": 2026,
  "month": 10
}
```

The backend calculates monthly analytics and budget usage first, then sends only
those aggregates to Groq. It does not send passwords, JWTs, email addresses,
transaction descriptions, or raw transaction records.

Response:

```json
{
  "success": true,
  "data": {
    "period": { "year": 2026, "month": 10 },
    "summary": "Food is your largest spending category...",
    "disclaimer": "Informational only; this is not financial advice."
  }
}
```

The endpoint is limited to five requests per user per fifteen minutes. If Groq
is unavailable, rate-limited, times out, or returns an invalid response, the
endpoint returns a safe `503` or `502` response and the core dashboard remains
available. Temporary provider failures receive a small bounded retry with
exponential backoff. Set `GROQ_MODEL` in `server/.env` to choose another model
available to your API key; the default is `openai/gpt-oss-120b`.

## Group expenses

Group expense amounts use integer minor units. For INR, `100` means ₹1.00.
Group expenses are intentionally separate from personal transactions and are
not included in `/api/analytics/monthly`; this prevents shared bills and
settlements from being double-counted in personal spending.

Protected endpoints include:

- `POST /api/groups`
- `GET /api/groups`
- `GET /api/groups/:id`
- `PATCH /api/groups/:id`
- `POST /api/groups/:id/invitations`
- `GET /api/groups/invitations`
- `POST /api/groups/invitations/:id/respond`
- `POST /api/groups/:id/leave`
- `GET /api/groups/:groupId/expenses`
- `POST /api/groups/:groupId/expenses`
- `PATCH /api/groups/:groupId/expenses/:id`
- `DELETE /api/groups/:groupId/expenses/:id`
- `GET /api/groups/:groupId/expenses/balances`
- `GET /api/groups/:groupId/expenses/balances/me`
- `GET /api/groups/:groupId/expenses/settlement-suggestions`
- `GET /api/groups/:groupId/expenses/settlements`
- `POST /api/groups/:groupId/expenses/settlements`

Invitations are delivered through the authenticated in-app invitation list;
there is no email or real-time push delivery. `GET /api/groups/invitations`
returns only pending invitations where the JWT subject is the `inviteeId`.
`POST /api/groups/invitations/:id/respond` accepts `{ "status": "accepted" }`
or `{ "status": "rejected" }`. The server verifies the recipient and pending
state, adds an accepted member once, and rejects repeated or unauthorized
responses.

Expense creation supports `equal`, `exact`, and `percentage` split methods.
Exact shares must total the expense amount and percentages must total 100%.
Equal and percentage splits allocate leftover paise deterministically in
participant order. Group, expense, balance, and settlement responses include
safe display names alongside stable user IDs; missing users are returned as
`Unknown member`. A positive balance means the member should receive money; a
negative balance means the member owes money. Settlement suggestions use a
greedy debtor-to-creditor algorithm and are suggestions, not proof that money
was transferred externally. `POST /api/groups/:groupId/expenses/settlements`
accepts an optional `idempotencyKey`; clients should reuse the same key when
retrying one record-payment request so a repeated submission returns the
original settlement instead of creating another record.

`GET /api/groups/:groupId/expenses/balances/me` returns only the authenticated
member's pairwise counterparties, totals owed, totals owed to them, and net
position. `GET /api/groups/:groupId/expenses/settlement-suggestions` likewise
returns only simplified settlement suggestions involving the authenticated
member.
