import { readFileSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { homedir } from "node:os";

export const CONFIG_FILE = ".twice.json";
export const LOCAL_FILE = ".twice-local.json";

export const DEFAULTS = {
  // Where the notes live. One markdown file per procedure.
  skillsDir: "skills",
  // Where established skills get linked so an agent can invoke them.
  target: "~/.claude/skills",
  // The rule. Two is the point of the name, but it is yours to set.
  minUses: 2,
  // Statuses the notes use. Renaming these is fine; the tool only compares.
  statuses: { established: "established", provisional: "provisional" },
};

export const expand = (p) => (p.startsWith("~") ? join(homedir(), p.slice(1)) : p);

export function loadConfig(root = process.cwd()) {
  const path = join(root, CONFIG_FILE);
  let parsed = {};
  if (existsSync(path)) {
    try {
      parsed = JSON.parse(readFileSync(path, "utf8"));
    } catch (err) {
      throw new Error(`${CONFIG_FILE} is not valid JSON: ${err.message}`);
    }
  }
  return {
    ...DEFAULTS,
    ...parsed,
    statuses: { ...DEFAULTS.statuses, ...(parsed.statuses || {}) },
    root,
    skillsPath: resolve(root, parsed.skillsDir ?? DEFAULTS.skillsDir),
    targetPath: resolve(expand(parsed.target ?? DEFAULTS.target)),
    _source: existsSync(path) ? path : "defaults",
  };
}

/**
 * Whether this checkout is allowed to write symlinks.
 *
 * This exists because of a real incident: the audit ran as a git pre-commit
 * hook, and a *clone* of the notes repo silently re-pointed every live skill at
 * the clone. The hook runs on every commit, so nobody chose it — and deleting
 * the clone left every skill dangling.
 *
 * So: validation runs everywhere, linking only happens where a human opted in
 * with `twice link`. The marker is local and gitignored, so a clone never
 * inherits it.
 */
export const isPrimary = (root = process.cwd()) => existsSync(join(root, LOCAL_FILE));
