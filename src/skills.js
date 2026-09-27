import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join, basename } from "node:path";
import { parse } from "./frontmatter.js";

export function scan(config) {
  if (!existsSync(config.skillsPath)) return [];
  return readdirSync(config.skillsPath)
    .filter((f) => f.endsWith(".md"))
    .sort()
    .map((file) => {
      const path = join(config.skillsPath, file);
      const slug = basename(file, ".md");
      const { data } = parse(readFileSync(path, "utf8"));
      const uses = Number(data.times_used || 0);
      return {
        slug,
        path,
        uses,
        name: data.name ?? null,
        description: data.description ?? null,
        status: data.status ?? null,
        lastUsed: data.last_used ?? null,
        established: uses >= config.minUses,
      };
    });
}

/**
 * The promotion rule, as checks. Returns problems that should fail a commit.
 * Anything advisory belongs in `warnings`, which never fails anything —
 * a check that blocks on style is a check people delete.
 */
export function validate(skills, config) {
  const problems = [];
  const warnings = [];
  const { established: EST, provisional: PROV } = config.statuses;

  for (const s of skills) {
    if (s.established) {
      if (!s.name) problems.push(`${s.slug}: used ${s.uses}x but has no name: in frontmatter`);
      else if (s.name !== s.slug)
        problems.push(`${s.slug}: name: is "${s.name}" — it must match the filename`);
      if (!s.description)
        problems.push(`${s.slug}: used ${s.uses}x but has no description:, so nothing will ever trigger it`);
      if (s.status !== EST)
        problems.push(`${s.slug}: used ${s.uses}x but status: is "${s.status}" — should be "${EST}"`);
    } else {
      if (s.status === EST)
        problems.push(
          `${s.slug}: status: ${EST} but only used ${s.uses}x — the rule says ${config.minUses}`,
        );
      if (s.status && s.status !== PROV)
        warnings.push(`${s.slug}: status: "${s.status}" is neither ${EST} nor ${PROV}`);
      if (s.uses === config.minUses - 1)
        warnings.push(`${s.slug}: one more use and it promotes`);
    }
  }
  return { problems, warnings };
}

export const partition = (skills) => ({
  established: skills.filter((s) => s.established),
  provisional: skills.filter((s) => !s.established),
});
