import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, readFileSync, mkdirSync, existsSync, lstatSync, readlinkSync } from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { parse, setField } from "../src/frontmatter.js";
import { scan, validate } from "../src/skills.js";
import { sync } from "../src/sync.js";
import { use } from "../src/use.js";
import { newSkill, markPrimary, init } from "../src/init.js";
import { loadConfig, isPrimary } from "../src/config.js";

const BIN = fileURLToPath(new URL("../bin/twice.js", import.meta.url));
let root, target;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "twice-root-"));
  target = mkdtempSync(join(tmpdir(), "twice-target-"));
  writeFileSync(join(root, ".twice.json"), JSON.stringify({ skillsDir: "skills", target, minUses: 2 }));
  mkdirSync(join(root, "skills"));
});

const cfg = () => loadConfig(root);
const note = (slug, fm, body = "# x\n") =>
  writeFileSync(join(root, "skills", `${slug}.md`), `---\n${fm}\n---\n${body}`);
const isLink = (p) => existsSync(p) && lstatSync(p).isSymbolicLink();

// --- frontmatter -------------------------------------------------------------

test("frontmatter reads scalars and leaves the body alone", () => {
  const { data, body } = parse(`---\nname: a-b\ntimes_used: 3\nstatus: established\n---\n# Title\ntext`);
  assert.equal(data.name, "a-b");
  assert.equal(data.times_used, 3);
  assert.equal(body, "# Title\ntext");
});

test("setField rewrites one field and adds a missing one", () => {
  const t = `---\nname: a\ntimes_used: 1\n---\nbody`;
  assert.match(setField(t, "times_used", 2), /times_used: 2/);
  assert.match(setField(t, "last_used", "2026-09-27"), /last_used: 2026-09-27/);
  assert.match(setField(t, "times_used", 2), /body$/);
});

test("a file with no frontmatter is returned untouched", () => {
  assert.equal(parse("just text").body, "just text");
  assert.equal(setField("just text", "a", 1), "just text");
});

// --- the rule ----------------------------------------------------------------

test("one use is provisional, two is established", () => {
  note("once", "name: once\ndescription: d\ntimes_used: 1\nstatus: provisional");
  note("twice-over", "name: twice-over\ndescription: d\ntimes_used: 2\nstatus: established");
  const skills = scan(cfg());
  assert.equal(skills.find((s) => s.slug === "once").established, false);
  assert.equal(skills.find((s) => s.slug === "twice-over").established, true);
  assert.deepEqual(validate(skills, cfg()).problems, []);
});

test("claiming established without the uses is a problem", () => {
  note("cheat", "name: cheat\ndescription: d\ntimes_used: 1\nstatus: established");
  const { problems } = validate(scan(cfg()), cfg());
  assert.equal(problems.length, 1);
  assert.match(problems[0], /only used 1x/);
});

test("an established note without a description is a problem, because nothing would trigger it", () => {
  note("nodesc", "name: nodesc\ntimes_used: 2\nstatus: established");
  const { problems } = validate(scan(cfg()), cfg());
  assert.ok(problems.some((p) => /no description/.test(p)));
});

test("a name that does not match the filename is a problem", () => {
  note("real-slug", "name: other-name\ndescription: d\ntimes_used: 2\nstatus: established");
  const { problems } = validate(scan(cfg()), cfg());
  assert.ok(problems.some((p) => /must match the filename/.test(p)));
});

test("one-away is a note, not a problem", () => {
  note("almost", "name: almost\ndescription: d\ntimes_used: 1\nstatus: provisional");
  const { problems, warnings } = validate(scan(cfg()), cfg());
  assert.deepEqual(problems, []);
  assert.ok(warnings.some((w) => /one more use/.test(w)));
});

// --- use ---------------------------------------------------------------------

test("use increments, stamps the date, and promotes at the threshold", () => {
  note("thing", "name: thing\ndescription: d\ntimes_used: 1\nstatus: provisional\nlast_used: 2020-01-01");
  const r = use(cfg(), "thing", { date: "2026-09-27" });
  assert.equal(r.after, 2);
  assert.equal(r.promoted, true);
  const text = readFileSync(r.path, "utf8");
  assert.match(text, /times_used: 2/);
  assert.match(text, /last_used: 2026-09-27/);
  assert.match(text, /status: established/);
});

test("use does not promote before the threshold", () => {
  note("thing", "name: thing\ndescription: d\ntimes_used: 0\nstatus: provisional");
  const r = use(cfg(), "thing");
  assert.equal(r.promoted, false);
  assert.match(readFileSync(r.path, "utf8"), /status: provisional/);
});

test("a gotcha is appended under the existing heading", () => {
  note("thing", "name: thing\ndescription: d\ntimes_used: 1", "# T\n\n## Gotchas\n- old one\n");
  use(cfg(), "thing", { gotcha: "the new one" });
  const text = readFileSync(join(root, "skills", "thing.md"), "utf8");
  assert.match(text, /## Gotchas\n- the new one\n- old one/);
});

test("using a note that does not exist explains how to make one", () => {
  assert.throws(() => use(cfg(), "ghost"), /twice new ghost/);
});

// --- sync --------------------------------------------------------------------

test("established notes are symlinked, not copied", () => {
  note("linked", "name: linked\ndescription: d\ntimes_used: 2\nstatus: established");
  const changes = sync(scan(cfg()), cfg());
  const link = join(target, "linked", "SKILL.md");
  assert.equal(changes[0].kind, "linked");
  assert.ok(isLink(link), "must be a symlink so the note and the skill are one file");
  assert.equal(resolve(readlinkSync(link)), resolve(join(root, "skills", "linked.md")));
});

test("provisional notes are never linked", () => {
  note("prov", "name: prov\ndescription: d\ntimes_used: 1\nstatus: provisional");
  sync(scan(cfg()), cfg());
  assert.equal(existsSync(join(target, "prov")), false);
});

test("a demoted note is unlinked on the next audit", () => {
  note("demote", "name: demote\ndescription: d\ntimes_used: 2\nstatus: established");
  sync(scan(cfg()), cfg());
  assert.ok(isLink(join(target, "demote", "SKILL.md")));

  note("demote", "name: demote\ndescription: d\ntimes_used: 1\nstatus: provisional");
  const changes = sync(scan(cfg()), cfg());
  assert.equal(changes[0].kind, "unlinked");
  assert.equal(isLink(join(target, "demote", "SKILL.md")), false);
});

test("sync never removes skills it does not own", () => {
  mkdirSync(join(target, "someone-elses"), { recursive: true });
  writeFileSync(join(target, "someone-elses", "SKILL.md"), "not ours");
  note("mine", "name: mine\ndescription: d\ntimes_used: 2\nstatus: established");
  sync(scan(cfg()), cfg());
  assert.equal(readFileSync(join(target, "someone-elses", "SKILL.md"), "utf8"), "not ours");
});

test("sync is idempotent", () => {
  note("stable", "name: stable\ndescription: d\ntimes_used: 2\nstatus: established");
  assert.equal(sync(scan(cfg()), cfg()).length, 1);
  assert.equal(sync(scan(cfg()), cfg()).length, 0);
});

test("dry run reports changes without making them", () => {
  note("dry", "name: dry\ndescription: d\ntimes_used: 2\nstatus: established");
  assert.equal(sync(scan(cfg()), cfg(), { dryRun: true }).length, 1);
  assert.equal(existsSync(join(target, "dry")), false);
});

// --- the clone incident ------------------------------------------------------

test("a checkout is not primary until a human runs `twice link`", () => {
  assert.equal(isPrimary(root), false);
  markPrimary(root);
  assert.equal(isPrimary(root), true);
});

test("audit in an unlinked clone validates but touches no symlinks", () => {
  note("shared", "name: shared\ndescription: d\ntimes_used: 2\nstatus: established");
  const out = execFileSync("node", [BIN, "audit"], { cwd: root, encoding: "utf8", env: { ...process.env, NO_COLOR: "1" } });
  assert.match(out, /symlinks not touched/);
  assert.equal(existsSync(join(target, "shared")), false, "a clone must never re-point live skills");
});

test("audit in the linked checkout does sync", () => {
  note("shared", "name: shared\ndescription: d\ntimes_used: 2\nstatus: established");
  markPrimary(root);
  execFileSync("node", [BIN, "audit"], { cwd: root, encoding: "utf8", env: { ...process.env, NO_COLOR: "1" } });
  assert.ok(isLink(join(target, "shared", "SKILL.md")));
});

// --- cli ---------------------------------------------------------------------

test("audit exits non-zero when the rule is broken", () => {
  note("cheat", "name: cheat\ndescription: d\ntimes_used: 1\nstatus: established");
  assert.throws(
    () => execFileSync("node", [BIN, "audit"], { cwd: root, encoding: "utf8", env: { ...process.env, NO_COLOR: "1" } }),
    /Command failed/,
  );
});

test("a broken rule blocks syncing even in the linked checkout", () => {
  note("cheat", "name: cheat\ndescription: d\ntimes_used: 1\nstatus: established");
  note("good", "name: good\ndescription: d\ntimes_used: 2\nstatus: established");
  markPrimary(root);
  try {
    execFileSync("node", [BIN, "audit"], { cwd: root, encoding: "utf8", env: { ...process.env, NO_COLOR: "1" } });
  } catch { /* expected */ }
  assert.equal(existsSync(join(target, "good")), false, "do not half-apply a broken state");
});

test("new scaffolds a note that already satisfies the validator", () => {
  newSkill(cfg(), "fresh-thing");
  const s = scan(cfg())[0];
  assert.equal(s.slug, "fresh-thing");
  assert.equal(s.name, "fresh-thing");
  assert.equal(s.uses, 1);
  assert.equal(s.established, false);
  assert.deepEqual(validate(scan(cfg()), cfg()).problems, []);
});

test("new refuses to clobber an existing note", () => {
  newSkill(cfg(), "dupe");
  assert.throws(() => newSkill(cfg(), "dupe"), /already exists/);
});

test("init creates config and skills dir and is safe to re-run", () => {
  const fresh = mkdtempSync(join(tmpdir(), "twice-init-"));
  assert.equal(init(fresh).length, 2);
  assert.equal(init(fresh).length, 0);
  assert.ok(existsSync(join(fresh, ".twice.json")));
});

test("a malformed config fails loudly instead of running with defaults", () => {
  writeFileSync(join(root, ".twice.json"), "{ broken");
  assert.throws(() => loadConfig(root), /not valid JSON/);
});

test("a gotcha lands below the template comment, not above it", () => {
  note("thing", "name: thing\ndescription: d\ntimes_used: 1",
    "# T\n\n## Gotchas\n<!-- The valuable part. -->\n- old one\n");
  use(cfg(), "thing", { gotcha: "new one" });
  const text = readFileSync(join(root, "skills", "thing.md"), "utf8");
  assert.match(text, /## Gotchas\n<!-- The valuable part\. -->\n- new one\n- old one/);
});

test("the summary line uses singular nouns for a count of one", () => {
  note("solo", "name: solo\ndescription: d\ntimes_used: 2\nstatus: established");
  const out = execFileSync("node", [BIN, "list"], { cwd: root, encoding: "utf8", env: { ...process.env, NO_COLOR: "1" } });
  assert.match(out, /1 established · 0 provisional · 0 notes · 0 problems/);
});
