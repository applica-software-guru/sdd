import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm, writeFile, readFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execSync } from "node:child_process";
import { SDD } from "../src/sdd.js";

function git(cmd: string, cwd: string): string {
  return execSync(`git ${cmd}`, { cwd, encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"] }).trim();
}

const VISION_MD = `---
title: "Product Vision"
status: new
author: ""
last-modified: "2024-01-01T00:00:00.000Z"
version: "1.0"
---

# Product Vision

A test project.
`;

describe("SDD integration", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "sdd-integration-"));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true });
  });

  it("init creates .sdd directory with config and git repo", async () => {
    const sdd = new SDD({ root: tempDir });

    const created = await sdd.init({ description: "A test app" });
    expect(created).toContain(".sdd/config.yaml");
    expect(created).toContain(".sdd/skill/sdd/SKILL.md");
    expect(created).toContain(".claude/skills/sdd/SKILL.md");
    expect(existsSync(join(tempDir, ".sdd"))).toBe(true);
    expect(existsSync(join(tempDir, ".git"))).toBe(true);
    expect(existsSync(join(tempDir, "product"))).toBe(true);
    expect(existsSync(join(tempDir, "system"))).toBe(true);
    expect(existsSync(join(tempDir, "code"))).toBe(true);
    expect(existsSync(join(tempDir, ".sdd/skill/sdd/SKILL.md"))).toBe(true);
    expect(existsSync(join(tempDir, ".sdd/skill/sdd/references/file-format.md"))).toBe(true);
    expect(existsSync(join(tempDir, ".sdd/skill/sdd/references/change-requests.md"))).toBe(true);
    expect(existsSync(join(tempDir, ".sdd/skill/sdd/references/bugs.md"))).toBe(true);
    expect(existsSync(join(tempDir, ".claude/skills/sdd/SKILL.md"))).toBe(true);
    expect(existsSync(join(tempDir, ".claude/skills/sdd/references/file-format.md"))).toBe(true);
    expect(existsSync(join(tempDir, ".claude/skills/sdd/references/change-requests.md"))).toBe(true);
    expect(existsSync(join(tempDir, ".claude/skills/sdd/references/bugs.md"))).toBe(true);

    const config = await sdd.config();
    expect(config.description).toBe("A test app");
  });

  it("full workflow: init → add doc → status → sync → mark-synced", async () => {
    const sdd = new SDD({ root: tempDir });
    await sdd.init({ description: "test" });
    git('config user.email "test@test.com"', tempDir);
    git('config user.name "Test"', tempDir);

    // Simulate user creating a doc file
    await writeFile(join(tempDir, "product/vision.md"), VISION_MD, "utf-8");

    // Status — file should be "new"
    const status = await sdd.status();
    expect(status.files.length).toBe(1);
    expect(status.files[0].status).toBe("new");

    // Sync — prompt should list the new file
    const prompt = await sdd.sync();
    expect(prompt).toContain("# SDD Sync Prompt");
    expect(prompt).toContain("product/vision.md");
    expect(prompt).toContain("**new**");

    // Validate
    const validation = await sdd.validate();
    expect(validation.valid).toBe(true);

    // Mark synced — single file
    const marked = await sdd.markSynced(["product/vision.md"]);
    expect(marked).toContain("product/vision.md");

    // Agent commits after mark-synced
    git("add .", tempDir);
    git('commit -m "sync: vision"', tempDir);

    // After commit, status should be synced
    const statusAfter = await sdd.status();
    expect(statusAfter.files[0].status).toBe("synced");
  });

  it("mark-synced with changed status", async () => {
    const sdd = new SDD({ root: tempDir });
    await sdd.init({ description: "test" });
    git('config user.email "test@test.com"', tempDir);
    git('config user.name "Test"', tempDir);

    const changedMd = VISION_MD.replace("status: new", "status: changed");
    await writeFile(join(tempDir, "product/vision.md"), changedMd, "utf-8");

    const marked = await sdd.markSynced();
    expect(marked).toContain("product/vision.md");

    const content = await readFile(join(tempDir, "product/vision.md"), "utf-8");
    expect(content).toContain("status: synced");
  });

  it("mark-synced with deleted status removes the file", async () => {
    const sdd = new SDD({ root: tempDir });
    await sdd.init({ description: "test" });
    git('config user.email "test@test.com"', tempDir);
    git('config user.name "Test"', tempDir);

    const deletedMd = VISION_MD.replace("status: new", "status: deleted");
    await writeFile(join(tempDir, "product/vision.md"), deletedMd, "utf-8");

    const marked = await sdd.markSynced();
    expect(marked[0]).toContain("removed");
    expect(existsSync(join(tempDir, "product/vision.md"))).toBe(false);
  });

  it("throws when project not initialized", async () => {
    const sdd = new SDD({ root: tempDir });
    await expect(sdd.status()).rejects.toThrow("No SDD project found");
  });

  it("init is idempotent for canonical and adapter skill files", async () => {
    const sdd = new SDD({ root: tempDir });
    const first = await sdd.init({ description: "test" });
    const second = await sdd.init({ description: "test" });
    expect(first).toContain(".sdd/skill/sdd/SKILL.md");
    expect(first).toContain(".claude/skills/sdd/SKILL.md");
    expect(second).not.toContain(".sdd/skill/sdd/SKILL.md");
    expect(second).not.toContain(".claude/skills/sdd/SKILL.md");
  });

  it("syncAdapters supports dry-run and selective adapters", async () => {
    const sdd = new SDD({ root: tempDir });
    await sdd.init({ description: "test" });

    const dryRun = await sdd.syncAdapters({ agents: ["copilot"], dryRun: true });
    expect(dryRun.selectedAgents).toEqual(["copilot"]);
    expect(dryRun.adapters.some((c) => c.path === ".github/copilot-instructions.md")).toBe(true);

    await sdd.syncAdapters({ agents: ["copilot"] });
    expect(existsSync(join(tempDir, ".github/copilot-instructions.md"))).toBe(true);
  });
});
