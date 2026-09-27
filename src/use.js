import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { parse, setField } from "./frontmatter.js";

/**
 * Record a use. This is the only thing that moves a note toward being
 * invocable, which is the whole point: uses are earned, not declared.
 */
export function use(config, slug, { gotcha, date = new Date().toISOString().slice(0, 10) } = {}) {
  const path = join(config.skillsPath, `${slug}.md`);
  if (!existsSync(path)) throw new Error(`no skill note at ${path} — create it with: twice new ${slug}`);

  let text = readFileSync(path, "utf8");
  const before = Number(parse(text).data.times_used || 0);
  const after = before + 1;

  text = setField(text, "times_used", after);
  text = setField(text, "last_used", date);

  const promoted = before < config.minUses && after >= config.minUses;
  if (after >= config.minUses) text = setField(text, "status", config.statuses.established);

  if (gotcha) {
    // Gotchas are the part worth having. Append under the heading if it exists.
    // Insert after the heading, and after the template's comment if it is still
    // there — a new entry sitting above the explanation reads like a mistake.
    const withComment = /^(##\s+Gotchas\s*\n(?:<!--[\s\S]*?-->\s*\n)?)/m;
    text = /^##\s+Gotchas\s*$/m.test(text)
      ? text.replace(withComment, `$1- ${gotcha}\n`)
      : text.trimEnd() + `\n\n## Gotchas\n- ${gotcha}\n`;
  }

  writeFileSync(path, text);
  return { slug, path, before, after, promoted, needsMeta: promoted };
}
