<p align="center">
  <img src="docs/media/logo.png" alt="SDD — Story Driven Development" width="200" />
</p>

# SDD — Story Driven Development

**The Story is the source of truth. The code follows.**

Programming languages were always an interface between humans and machines. We invented them because machines didn't speak our language. Syntax, compilers, frameworks — all layers we built to translate human intent into machine instructions.

But now the agent sits in between. It reads, it interprets, it builds.

So what's the real language we're using? **The Story.**

Not the User Story in the agile sense. Something bigger. The complete narrative of a system: what it does, for whom, why it exists, how it behaves, what happens at the edges. Functional flows, entity models, behavioral rules — all written as a coherent, living document before a single line of code is generated.

**Story Driven Development** is a methodology and a lightweight toolchain that supports agentic development through structured documentation. It's not a framework — it's a thin layer that connects your narrative to your coding agent. You write the Story, the agent writes the code.

## Why SDD?

When you run a complex project through a coding agent, **prompts don't scale**. Context drifts, references get lost between layers, and the codebase starts to diverge from the original intent. The agent is powerful — but it has no memory of why things were built a certain way.

SDD solves this:

- **The Story is the source of truth** — the agent doesn't receive prompts, it receives the Story
- **Change requests go through documentation** — update the Story first, then the agent aligns the code
- **Your project is always documented** — always coherent, always explainable to anyone on the team
- **Agent-agnostic** — works with Claude, GPT, Copilot, Cursor, or any LLM

This changes the role of the developer. You stop thinking in functions and start thinking in narratives. You stop debugging syntax and start refining intent.

## Quick Start

```bash
# Install via Homebrew (macOS)
brew install applica-software-guru/sdd/sdd

# Install via npm (all platforms)
npm install -g @applica-software-guru/sdd

# Create a new project
sdd init my-project

# Write your documentation, then let the agent work
sdd sync
```

That's it. `sdd sync` generates the prompt for any coding agent to implement what you documented.

## How It Works

```
You write the Story    →    SDD detects changes    →    Agent implements code
     (markdown)              (status tracking)           (from sync prompt)
```

1. **Write documentation** in `product/` and `system/` as Markdown with YAML frontmatter
2. **SDD tracks status** — each file is `draft`, `new`, `changed`, `deleted`, or `synced`
3. **`sdd sync`** generates a structured prompt with what needs to be implemented
4. **The agent implements** what the documentation describes
5. **`sdd mark-synced`** marks files as done, then you commit

## SDD and Spec-Driven Development

SDD is an implementation of [Spec-Driven Development](https://martinfowler.com/articles/exploring-gen-ai/sdd-3-tools.html) — the practice of treating specifications as the primary artifact, with code as a derived layer.

Martin Fowler identifies a spectrum: from _spec-first_ (write specs once, generate code) to _spec-anchored_ (specs evolve with the codebase) to _spec-as-source_ (only specs are edited by humans). SDD targets the **spec-anchored** and **spec-as-source** ends: the status lifecycle (`draft → new → synced → changed`) and git-diff-based sync are designed to keep the Story as the persistent source of truth across the full lifetime of a project — not just at initialization.

The key difference from other spec-driven tools is scope and lifecycle: SDD covers the full product narrative — vision, users, features, entities, architecture — not just API contracts or data schemas. And rather than generating code once, the status lifecycle and git-diff-based sync are designed to keep specs and code aligned continuously.

## Documentation

- [Getting Started](docs/getting-started.md) — installation, first project, workflow
- [Agent Workflow](docs/agent-workflow.md) — using SDD with Claude Code, Copilot, Cursor
- [Concepts](docs/concepts.md) — how SDD works, status lifecycle, project structure
- [CLI Reference](docs/cli-reference.md) — all commands and options
- [Change Requests](docs/change-requests.md) — structured change management
- [Bugs](docs/bugs.md) — bug tracking for the agent
- [UX & Screenshots](docs/ux-screenshots.md) — managing mockups and visual assets
- [VS Code Extension](docs/vscode-extension.md) — sidebar, status bar, auto-frontmatter
- [Claude Code Plugin](docs/claude-code-plugin.md) — Agent Skills for Claude Code (marketplace)
- [Remote Sync](docs/remote-sync.md) — connecting to SDD Flow, push/pull, draft enrichment
- [Remote Workers](docs/remote-worker.md) — run AI jobs from the SDD Flow web UI on a local machine
- [Homebrew Release Workflow](docs/homebrew-release-workflow.md) — how npm release syncs to Homebrew tap

## Packages

| Package                           | Description                                            |
| --------------------------------- | ------------------------------------------------------ |
| `@applica-software-guru/sdd-core` | Core library — parser, prompt generator, status engine    |
| `@applica-software-guru/sdd`      | CLI tool                                                  |
| `@applica-software-guru/sdd-ui`   | Optional split-panel UI editor for React component dev    |
| `sdd-vscode`                      | VS Code extension                                         |
| `sdd` (Claude Code plugin)        | Agent Skills + slash commands + session hook for Claude   |

## Maintainers

Release publish and Homebrew sync are automated via GitHub Actions.

When a GitHub Release is published, `.github/workflows/sync-homebrew-tap.yml` publishes `@applica-software-guru/sdd` to npm and then updates `Formula/sdd.rb` in the tap repository (`applica-software-guru/homebrew-sdd`).

Required secret in this repository:

- `NPM_TOKEN`: npm automation token for publishing `@applica-software-guru/sdd`
- `HOMEBREW_TAP_TOKEN`: GitHub token with write access to `applica-software-guru/homebrew-sdd`

See [Homebrew Release Workflow](docs/homebrew-release-workflow.md) for release order, manual dispatch, and troubleshooting.

## Author

**Bruno Fortunato** — [bruno.fortunato@applica.guru](mailto:bruno.fortunato@applica.guru)

## License

MIT
