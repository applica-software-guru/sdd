---
title: "Data Entities"
status: new
author: ""
last-modified: "2026-03-04T00:00:00.000Z"
version: "1.0"
---

# Data Entities

## Agent Notes

- All entities are stored in a single SQLite database at `code/db/taskm.db`
- Use `better-sqlite3` for synchronous DB access in Next.js API routes
- Run migrations from `code/db/migrations/` on app startup

---

### Task

Represents a single to-do item.

| Column       | Type      | Constraints              | Description                        |
|--------------|-----------|--------------------------|------------------------------------|
| `id`         | INTEGER   | PRIMARY KEY AUTOINCREMENT | Unique identifier                  |
| `title`      | TEXT      | NOT NULL                 | Task text, max 500 characters      |
| `completed`  | INTEGER   | NOT NULL, DEFAULT 0      | Boolean: 0 = active, 1 = done      |
| `created_at` | TEXT      | NOT NULL                 | ISO 8601 timestamp, set on insert  |
| `updated_at` | TEXT      | NOT NULL                 | ISO 8601 timestamp, updated on edit|

#### Notes

- `completed` is stored as INTEGER (SQLite has no boolean type)
- `created_at` and `updated_at` are ISO 8601 strings (e.g. `2026-03-04T10:00:00.000Z`)
- Default sort: `created_at DESC`
