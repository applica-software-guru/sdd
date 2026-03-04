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
2. **SDD tracks status** — each file is `new`, `changed`, `deleted`, or `synced`
3. **`sdd sync`** generates a structured prompt with what needs to be implemented
4. **The agent implements** what the documentation describes
5. **`sdd mark-synced`** marks files as done, then you commit

## Documentation

- [Getting Started](docs/getting-started.md) — installation, first project, workflow
- [Agent Workflow](docs/agent-workflow.md) — using SDD with Claude Code, Copilot, Cursor
- [Concepts](docs/concepts.md) — how SDD works, status lifecycle, project structure
- [CLI Reference](docs/cli-reference.md) — all commands and options
- [Change Requests](docs/change-requests.md) — structured change management
- [UX & Screenshots](docs/ux-screenshots.md) — managing mockups and visual assets
- [VS Code Extension](docs/vscode-extension.md) — sidebar, status bar, auto-frontmatter

## Packages

| Package | Description |
|---------|-------------|
| `@applica-software-guru/sdd-core` | Core library — parser, prompt generator, status engine |
| `@applica-software-guru/sdd` | CLI tool |
| `sdd-vscode` | VS Code extension |

## Author

**Bruno Fortunato** — [bruno.fortunato@applica.guru](mailto:bruno.fortunato@applica.guru)

## License

MIT
