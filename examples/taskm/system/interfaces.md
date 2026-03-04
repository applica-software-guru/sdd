---
title: "API Interfaces"
status: new
author: ""
last-modified: "2026-03-04T00:00:00.000Z"
version: "1.0"
---

# API Interfaces

All endpoints are Next.js API Routes under `/api/tasks`. Requests and responses use JSON. No authentication headers required.

---

## GET /api/tasks

Fetch all tasks, sorted by `created_at` descending.

### Query Parameters

| Param    | Type   | Required | Values                  | Description            |
|----------|--------|----------|-------------------------|------------------------|
| `filter` | string | No       | `all`, `active`, `completed` | Default: `all`    |

### Response `200 OK`

```json
[
  {
    "id": 1,
    "title": "Buy groceries",
    "completed": false,
    "created_at": "2026-03-04T10:00:00.000Z",
    "updated_at": "2026-03-04T10:00:00.000Z"
  }
]
```

---

## POST /api/tasks

Create a new task.

### Request Body

```json
{
  "title": "Buy groceries"
}
```

| Field   | Type   | Required | Constraints      |
|---------|--------|----------|------------------|
| `title` | string | Yes      | Non-empty, max 500 chars |

### Response `201 Created`

Returns the created task object:

```json
{
  "id": 2,
  "title": "Buy groceries",
  "completed": false,
  "created_at": "2026-03-04T10:01:00.000Z",
  "updated_at": "2026-03-04T10:01:00.000Z"
}
```

### Error `400 Bad Request`

```json
{ "error": "Title is required" }
```

---

## PATCH /api/tasks/[id]

Update a task's title or completion status.

### Request Body

All fields optional; at least one must be provided.

```json
{
  "title": "Buy groceries and coffee",
  "completed": true
}
```

| Field       | Type    | Required | Description                   |
|-------------|---------|----------|-------------------------------|
| `title`     | string  | No       | New title, non-empty, max 500 |
| `completed` | boolean | No       | New completion state          |

### Response `200 OK`

Returns the updated task object.

### Error `404 Not Found`

```json
{ "error": "Task not found" }
```

---

## DELETE /api/tasks/[id]

Delete a task permanently.

### Response `200 OK`

```json
{ "success": true }
```

### Error `404 Not Found`

```json
{ "error": "Task not found" }
```
