# UX & Screenshots

When a feature has UX mockups or screenshots, place them alongside the feature documentation.

## Simple feature (no screenshots)

A single file is enough:

```
product/features/auth.md
```

## Feature with screenshots

Use a folder with `index.md` and images next to it:

```
product/features/auth/
  index.md          # feature documentation
  login.png         # screenshot
  register.png      # screenshot
```

Reference images in the markdown with relative paths:

```markdown
## UX

![Login screen](login.png)
![Register screen](register.png)
```

## Both formats work

You can mix and match in the same project:

```
product/features/
  simple-thing.md                # no screenshots needed
  dashboard/                     # has screenshots
    index.md
    main-view.png
    settings-panel.png
```

The SDD parser discovers all `*.md` files under `product/` and `system/` regardless of nesting depth. No configuration needed.

## Visual iteration with the UI editor

When you have a screenshot and want to build the React component to match it exactly, use `sdd ui launch-editor`:

```bash
sdd ui launch-editor LoginForm \
  --screenshot product/features/auth/login.png \
  --detach
```

This opens a split-panel editor at `http://localhost:5174`:
- **Left panel** — your spec screenshot (with tab support for multiple screenshots)
- **Right panel** — live React component preview with Vite HMR

The agent edits `code/components/LoginForm.tsx`, takes a Playwright screenshot of the preview, compares it with the spec, and iterates until they match. See [`.claude/skills/sdd-ui/SKILL.md`](./../packages/skill/sdd-ui/SKILL.md) for the full workflow.

```bash
# Stop the editor when done
sdd ui stop
```

## Tips

- Use descriptive filenames: `login-form.png` not `screen1.png`
- Keep images next to the doc that references them
- The coding agent can read images if it's multimodal — it will use the screenshots to understand what to implement
- For pixel-accurate component implementation, use `sdd ui launch-editor` with the Playwright MCP for visual feedback
