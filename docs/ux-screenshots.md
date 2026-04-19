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

## Optional: side-by-side editor for React components

For React projects that want a visual side-by-side editor, the optional `@applica-software-guru/sdd-ui` package provides a split-panel tool:

```bash
# Install the optional package
npm install -g @applica-software-guru/sdd-ui

# Launch the editor
sdd ui launch-editor LoginForm \
  --screenshot product/features/auth/login.png \
  --detach

# Stop it when done
sdd ui stop
```

The editor opens at `http://localhost:5174` with the spec screenshot on the left and a live React preview (Vite HMR) on the right, so you can eyeball the match as the agent iterates.

This is a standalone CLI utility — not a skill. The core `sdd` workflow already implements UI components by reading the spec screenshots directly.

## Tips

- Use descriptive filenames: `login-form.png` not `screen1.png`
- Keep images next to the doc that references them
- The coding agent reads images directly from the doc — no extra tooling needed for most cases
