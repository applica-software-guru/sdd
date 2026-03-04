---
title: "Task Management"
status: new
author: ""
last-modified: "2026-03-04T00:00:00.000Z"
version: "1.0"
---

# Task Management

The core feature. Users can create, view, edit, complete, and delete tasks. All tasks appear in a single chronological list.

## User Stories

- As a user, I can type a task title and press Enter to add it instantly
- As a user, I can see all my tasks in a list, newest first
- As a user, I can click a checkbox to mark a task as complete
- As a user, I can click a task title to edit it inline
- As a user, I can delete a task with a delete button or keyboard shortcut
- As a user, I can filter the list to show only active or only completed tasks

## UX

### Task List

- Single full-width list, centered on screen with max-width ~640px
- Each row: `[checkbox] [title] [delete button]`
- Checkbox toggles completion; completed tasks show strikethrough title
- Delete button appears on row hover
- Input field pinned at the top: placeholder "Add a task…", submit on Enter

### Filter Tabs

- Three tabs above the list: **All** | **Active** | **Completed**
- Default view: **All**

### Inline Edit

- Clicking the task title turns it into an input field
- Press Enter or blur to save, Escape to cancel

## Behavior

- Tasks are stored persistently in SQLite via a Next.js API route
- No optimistic UI required; wait for server response before updating the list
- Empty title is not allowed; show no error, just ignore the submit

## Agent Notes

- Implement as a single page (`/`) — no routing needed beyond the root
- Use shadcn `Input`, `Checkbox`, `Button`, and `Tabs` components
- The task list is fetched on page load via `GET /api/tasks`
