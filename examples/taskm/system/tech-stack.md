---
title: "Tech Stack"
status: new
author: ""
last-modified: "2026-03-04T00:00:00.000Z"
version: "1.0"
---

# Tech Stack

## Runtime & Framework

| Technology    | Version  | Role                                  |
|---------------|----------|---------------------------------------|
| Node.js       | 20 LTS   | Runtime                               |
| Next.js       | 15       | Full-stack framework (App Router)     |
| TypeScript    | 5        | Language                              |

## Frontend

| Technology    | Role                                              |
|---------------|---------------------------------------------------|
| React 19      | UI library                                        |
| shadcn/ui     | Component library (built on Radix UI + Tailwind)  |
| Tailwind CSS  | Utility-first styling                             |

### shadcn components used

- `Input` — task entry field
- `Checkbox` — toggle task completion
- `Button` — delete action
- `Tabs` — filter (All / Active / Completed)

## Backend / Data

| Technology      | Role                                         |
|-----------------|----------------------------------------------|
| Next.js API Routes | HTTP endpoints, runs server-side in Node  |
| better-sqlite3  | Synchronous SQLite driver for Node.js        |
| SQLite          | Embedded database, stored as a local file    |

## Tooling

| Tool    | Role                  |
|---------|-----------------------|
| ESLint  | Linting               |
| Prettier| Code formatting       |

## Agent Notes

- Bootstrap with: `npx create-next-app@latest code --typescript --tailwind --eslint --app --src-dir no`
- Then: `npx shadcn@latest init` inside `code/`
- Install DB driver: `npm install better-sqlite3 && npm install -D @types/better-sqlite3`
