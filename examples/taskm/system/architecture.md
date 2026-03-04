---
title: "Architecture"
status: new
author: ""
last-modified: "2026-03-04T00:00:00.000Z"
version: "1.0"
---

# Architecture

## Overview

A standard Next.js full-stack app. The frontend is a single React page. The backend is a set of Next.js API Routes that talk to a local SQLite database via `better-sqlite3`.

```
Browser (React + shadcn)
        │  fetch()
        ▼
Next.js API Routes (/api/tasks/*)
        │  better-sqlite3 (sync)
        ▼
SQLite file (code/db/taskm.db)
```

## Decisions

### No ORM

SQLite is accessed with raw SQL via `better-sqlite3`. The schema is simple (one table) and an ORM adds unnecessary complexity for this scope.

### Synchronous DB access

`better-sqlite3` is synchronous. API routes are simple enough that async is not needed and sync keeps the code simpler.

### No state management library

React `useState` + `useEffect` is sufficient. No Redux, Zustand, or React Query needed for a single-entity list.

### No authentication

The app is single-user, locally hosted. There is no login, session, or auth middleware.

### Single page, no routing

All UI lives on `/`. There are no sub-pages or dynamic routes on the frontend.

## Code Structure

```
code/
  app/
    page.tsx            ← main UI
    layout.tsx          ← root layout with shadcn theme
    api/
      tasks/
        route.ts        ← GET, POST
        [id]/
          route.ts      ← PATCH, DELETE
  components/
    task-list.tsx
    task-item.tsx
    add-task-input.tsx
    filter-tabs.tsx
  db/
    client.ts           ← singleton better-sqlite3 connection
    migrations/
      001_create_tasks.sql
  lib/
    types.ts            ← shared TypeScript types
```
