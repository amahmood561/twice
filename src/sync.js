import { mkdirSync, symlinkSync, readdirSync, existsSync, lstatSync, readlinkSync, rmSync, rmdirSync } from "node:fs";
import { join, dirname, resolve } from "node:path";

const realpath = (p) => {
  try { return resolve(readlinkSync(p)); } catch { return null; }
};
const isLink = (p) => { try { return lstatSync(p).isSymbolicLink(); } catch { return false; } };

export const linkPath = (config, slug) => join(config.targetPath, slug, "SKILL.md");

/**
 * Make the target directory reflect the established skills.
 *
 * The vault note and the invocable skill are the same file — a symlink, not a
 * copy. Copying means two files that drift, and the one the agent runs is the
 * one nobody edits.
 */
export function sync(skills, config, { dryRun = false } = {}) {
  const changes = [];
  const wanted = new Map(skills.filter((s) => s.established).map((s) => [s.slug, s.path]));

  for (const [slug, src] of wanted) {
    const link = linkPath(config, slug);
    if (isLink(link) && realpath(link) === resolve(src)) continue;
    if (!dryRun) {
      mkdirSync(dirname(link), { recursive: true });
      if (existsSync(link) || isLink(link)) rmSync(link, { force: true });
      symlinkSync(resolve(src), link);
    }
    changes.push({ kind: "linked", slug });
  }

  // Only ever remove links that point back into our own skills directory.
  // Anything else in the target belongs to someone else.
  if (existsSync(config.targetPath)) {
    for (const dir of readdirSync(config.targetPath).sort()) {
      const link = join(config.targetPath, dir, "SKILL.md");
      if (!isLink(link)) continue;
      const points = realpath(link);
      if (!points || !points.startsWith(resolve(config.skillsPath))) continue;
      if (wanted.has(dir)) continue;
      if (!dryRun) {
        rmSync(link, { force: true });
        try { rmdirSync(dirname(link)); } catch { /* other files live there; leave it */ }
      }
      changes.push({ kind: "unlinked", slug: dir });
    }
  }
  return changes;
}
