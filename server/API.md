# SpendWise API

All transaction endpoints require:

```http
Authorization: Bearer <jwt>
```

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
those aggregates to Gemini. It does not send passwords, JWTs, email addresses,
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

The endpoint is limited to five requests per user per fifteen minutes. If Gemini
is unavailable, the endpoint returns a safe `503` response and the core
dashboard remains available. The default model is `gemini-3.8-flash`; set
`GEMINI_MODEL` in `server/.env` if you want to use another model available to
your API key.
