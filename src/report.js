const C = process.stdout.isTTY && !process.env.NO_COLOR;
const g = (s) => (C ? `\x1b[32m${s}\x1b[0m` : s);
const y = (s) => (C ? `\x1b[33m${s}\x1b[0m` : s);
const r = (s) => (C ? `\x1b[31m${s}\x1b[0m` : s);
const b = (s) => (C ? `\x1b[1m${s}\x1b[0m` : s);

export function auditReport({ skills, problems, warnings, changes, config, primary, dryRun }) {
  const est = skills.filter((s) => s.established);
  const prov = skills.filter((s) => !s.established);
  const out = [];

  out.push("", `${b("twice")}  a skill needs ${config.minUses}+ uses to be invocable`, "");

  out.push(b("Established") + " — linked into " + config.target);
  if (!est.length) out.push(`  ${y("·")} none yet`);
  for (const s of est) out.push(`  ${g("✓")} ${s.slug.padEnd(38)} ${s.uses}x`);

  out.push("", b("Provisional") + " — in the repo, not invocable");
  if (!prov.length) out.push(`  ${y("·")} none`);
  for (const s of prov) {
    const need = config.minUses - s.uses;
    out.push(`  ${y("·")} ${s.slug.padEnd(38)} ${s.uses}x  (needs ${need} more)`);
  }

  if (changes.length) {
    out.push("", b("Changes") + (dryRun ? " (dry run)" : ""));
    for (const c of changes) out.push(`  ${c.kind === "linked" ? "+" : "-"} ${c.kind.padEnd(9)} ${c.slug}`);
  }

  if (!primary) {
    out.push("", `  ${y("·")} symlinks not touched — this checkout has not been linked.`);
    out.push(`    Run ${b("twice link")} here if this is the copy your agent should use.`);
  }

  if (warnings.length) {
    out.push("", b("Notes") + " — informational, never fails");
    for (const w of warnings) out.push(`  ${y("·")} ${w}`);
  }

  if (problems.length) {
    out.push("", b(r("Problems")));
    for (const p of problems) out.push(`  ${r("✗")} ${p}`);
  }

  const n = (count, one, many = one + "s") => `${count} ${count === 1 ? one : many}`;
  out.push(
    "",
    // "established" and "provisional" are adjectives here, so they never take an s.
    `${n(est.length, "established", "established")} · ${n(prov.length, "provisional", "provisional")} · ` +
      `${n(warnings.length, "note")} · ${n(problems.length, "problem")}`,
    "",
  );
  return out.join("\n");
}
