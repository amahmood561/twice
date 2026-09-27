#!/usr/bin/env node
import { loadConfig, isPrimary, LOCAL_FILE } from "../src/config.js";
import { scan, validate } from "../src/skills.js";
import { sync } from "../src/sync.js";
import { auditReport } from "../src/report.js";
import { init, newSkill, markPrimary, installHook } from "../src/init.js";
import { use } from "../src/use.js";

const [, , cmd = "help", ...rest] = process.argv;
const has = (f) => rest.includes("--" + f);
const arg = (f, d) => { const i = rest.indexOf("--" + f); return i >= 0 ? rest[i + 1] : d; };
const positional = rest.filter((a) => !a.startsWith("--") && rest[rest.indexOf(a) - 1]?.startsWith("--") !== true);

const HELP = `twice — agent skills that earn their place

  A procedure is not invocable until you have done it twice. Established notes
  are symlinked into your agent's skills directory; the note IS the skill file,
  so there is no copy to drift.

  twice init [--skills-dir skills]   create the config and the skills directory
  twice new <name>                   scaffold a note from the template
  twice use <name> [--gotcha "..."]  record a use; promotes automatically
  twice audit [--dry-run] [--no-sync]  enforce the rule and sync symlinks
  twice list                         what is established, what is one use away
  twice link                         mark THIS checkout as the one that owns the symlinks
  twice install-hook                 run the audit on every commit

Docs: https://github.com/amahmood561/twice`;

function audit({ dryRun = false, noSync = false } = {}) {
  const config = loadConfig();
  const skills = scan(config);
  const { problems, warnings } = validate(skills, config);
  const primary = isPrimary(config.root);
  const changes = primary && !noSync && !problems.length ? sync(skills, config, { dryRun }) : [];
  process.stdout.write(
    auditReport({ skills, problems, warnings, changes, config, primary: primary || noSync, dryRun }),
  );
  return problems.length ? 1 : 0;
}

try {
  if (cmd === "init") {
    const written = init(process.cwd(), { skillsDir: arg("skills-dir", "skills") });
    console.log("twice initialised.\n");
    for (const w of written) console.log("  created  " + w);
    console.log("\nNext:  twice new <name>   then   twice link");
  } else if (cmd === "new") {
    const slug = positional[0];
    if (!slug) throw new Error("usage: twice new <name>");
    console.log("created  " + newSkill(loadConfig(), slug, { title: arg("title") }));
    console.log("\nIt starts at 1 use and is not invocable. Use it again and run: twice use " + slug);
  } else if (cmd === "use") {
    const slug = positional[0];
    if (!slug) throw new Error("usage: twice use <name>");
    const r = use(loadConfig(), slug, { gotcha: arg("gotcha") });
    console.log(`${r.slug}: ${r.before} → ${r.after} uses`);
    if (r.promoted) {
      console.log("\nPromoted. Fill in name: and description: if they are still placeholders,");
      console.log("then run:  twice audit");
    }
  } else if (cmd === "audit") {
    process.exit(audit({ dryRun: has("dry-run"), noSync: has("no-sync") }));
  } else if (cmd === "list") {
    process.exit(audit({ noSync: true }));
  } else if (cmd === "link") {
    console.log("marked as primary: " + markPrimary(process.cwd()));
    console.log(`\n${LOCAL_FILE} is gitignored on purpose — a clone must never inherit it`);
    console.log("and silently re-point your live skills. Run: twice audit");
  } else if (cmd === "install-hook") {
    console.log("installed  " + installHook(process.cwd()));
  } else {
    console.log(HELP);
  }
} catch (err) {
  console.error("twice: " + err.message);
  process.exit(1);
}
