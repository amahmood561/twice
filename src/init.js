import { writeFileSync, mkdirSync, existsSync, readFileSync, chmodSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { DEFAULTS, CONFIG_FILE, LOCAL_FILE } from "./config.js";

const templateDir = fileURLToPath(new URL("../templates/", import.meta.url));

export function init(root, { skillsDir = DEFAULTS.skillsDir } = {}) {
  const written = [];
  const cfg = join(root, CONFIG_FILE);
  if (!existsSync(cfg)) {
    const { target, minUses } = DEFAULTS;
    writeFileSync(cfg, JSON.stringify({ skillsDir, target, minUses }, null, 2) + "\n");
    written.push(cfg);
  }
  const dir = join(root, skillsDir);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
    written.push(dir + "/");
  }
  return written;
}

export function newSkill(config, slug, { title } = {}) {
  const path = join(config.skillsPath, `${slug}.md`);
  if (existsSync(path)) throw new Error(`${path} already exists`);
  mkdirSync(config.skillsPath, { recursive: true });
  const today = new Date().toISOString().slice(0, 10);
  const body = readFileSync(join(templateDir, "skill.md"), "utf8")
    .replace("<matches the filename exactly, kebab-case>", slug)
    .replace("<YYYY-MM-DD>", today)
    .replace("# <Title>", "# " + (title || slug.replace(/-/g, " ")));
  writeFileSync(path, body);
  return path;
}

export const markPrimary = (root) => {
  const p = join(root, LOCAL_FILE);
  writeFileSync(p, JSON.stringify({ primary: true, linkedAt: new Date().toISOString() }, null, 2) + "\n");
  return p;
};

const HOOK = `#!/bin/sh
# Installed by \`twice install-hook\`. Blocks a commit that breaks the promotion rule.
exec npx --no-install twice audit --no-sync
`;

export function installHook(root) {
  const dir = join(root, ".git", "hooks");
  if (!existsSync(dir)) throw new Error("no .git/hooks here — is this a git repository?");
  const path = join(dir, "pre-commit");
  if (existsSync(path) && !readFileSync(path, "utf8").includes("twice audit")) {
    throw new Error(`${path} already exists and is not ours — add \`twice audit --no-sync\` to it yourself`);
  }
  writeFileSync(path, HOOK);
  chmodSync(path, 0o755);
  return path;
}
