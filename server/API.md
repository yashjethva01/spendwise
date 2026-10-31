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
