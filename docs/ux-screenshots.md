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

## Tips

- Use descriptive filenames: `login-form.png` not `screen1.png`
- Keep images next to the doc that references them
- The coding agent can read images if it's multimodal — it will use the screenshots to understand what to implement
