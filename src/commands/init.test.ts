import { describe, it, expect, beforeEach } from "vitest";
import { mkdtempSync, readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { detectReleaseTriggerWorkflows, scaffoldFiles } from "./init.js";

describe("scaffoldFiles", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "rpb-test-"));
  });

  it("creates all workflow and config files", () => {
    const result = scaffoldFiles(tempDir, {
      claudeActionSha: "abc123def456",
      releaseTriggerWorkflows: ["CI"],
    });

    expect(result.created).toContain(".github/workflows/triage-agent.yml");
    expect(result.created).toContain(".github/workflows/implement-agent.yml");
    expect(result.created).toContain(".github/workflows/gate-runner.yml");
    expect(result.created).toContain(".github/workflows/release-runner.yml");
    expect(result.created).toContain(".github/repo-policy.md");
    expect(result.created).toContain(".github/repo-policy.yml");
    expect(result.skipped.length).toBe(0);
  });

  it("replaces template placeholders", () => {
    scaffoldFiles(tempDir, {
      claudeActionSha: "abc123def456",
      releaseTriggerWorkflows: ["package-smoke", "validate-swift"],
    });

    const triage = readFileSync(
      join(tempDir, ".github/workflows/triage-agent.yml"),
      "utf-8"
    );
    expect(triage).toContain("abc123def456");
    expect(triage).not.toContain("{{CLAUDE_ACTION_SHA}}");

    const release = readFileSync(
      join(tempDir, ".github/workflows/release-runner.yml"),
      "utf-8"
    );
    expect(release).toContain('workflows: ["package-smoke", "validate-swift"]');
    expect(release).not.toContain("{{RELEASE_TRIGGER_WORKFLOWS}}");
  });

  it("omits workflow_run when no release trigger workflows are configured", () => {
    scaffoldFiles(tempDir, {
      claudeActionSha: "abc123def456",
      releaseTriggerWorkflows: [],
    });

    const release = readFileSync(
      join(tempDir, ".github/workflows/release-runner.yml"),
      "utf-8"
    );
    expect(release).not.toContain("workflow_run:");
  });

  it("detects CI-like workflows from the repo", () => {
    const workflowsDir = join(tempDir, ".github/workflows");
    mkdirSync(workflowsDir, { recursive: true });

    writeFileSync(
      join(workflowsDir, "validate-swift.yml"),
      [
        "name: validate-swift",
        "",
        "on:",
        "  push:",
        "  pull_request:",
      ].join("\n")
    );
    writeFileSync(
      join(workflowsDir, "package-smoke.yml"),
      [
        "name: package-smoke",
        "",
        "on: [pull_request, workflow_dispatch]",
      ].join("\n")
    );
    writeFileSync(
      join(workflowsDir, "release-dmg.yml"),
      [
        "name: Build macOS DMG",
        "",
        "on:",
        "  workflow_dispatch:",
        "  release:",
        "    types: [published]",
      ].join("\n")
    );

    expect(detectReleaseTriggerWorkflows(tempDir)).toEqual([
      "package-smoke",
      "validate-swift",
    ]);
  });

  it("skips existing files", () => {
    scaffoldFiles(tempDir, { claudeActionSha: "abc123", releaseTriggerWorkflows: ["CI"] });
    const result = scaffoldFiles(tempDir, { claudeActionSha: "abc123", releaseTriggerWorkflows: ["CI"] });
    expect(result.skipped.length).toBe(6);
    expect(result.created.length).toBe(0);
  });
});
