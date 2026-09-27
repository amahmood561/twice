# twice

**Agent skills that earn their place. A procedure is not invocable until you have done it twice.**

Every agent memory system is a vector store. This one is a rule.

---

## The problem

You tell your agent "remember how to do this" and it writes a note. Three weeks later your
skills directory has forty notes. Some are procedures you run constantly. Most are one-time
things you will never do again — a dependency you upgraded once, a bug in a service you no
longer use.

The agent reads all of it. You stop opening the folder. The memory system quietly became
noise, and nothing told you when it crossed that line.

## The rule

> **A note becomes an invocable skill only after you have done the thing twice.**

One use is an anecdote. Two is a pattern. The second use is also the moment you learn what
was actually reusable and what was specific to that day — which is why a note written after
the second run is worth more than the same note written after the first.

- **1 use** → the note lives in your repo. Not invocable. Costs the agent nothing.
- **2+ uses** → symlinked into your agent's skills directory. Now it is live.

`twice` enforces that as a pre-commit hook. A note claiming `status: established` with one
use does not commit.

---

## Install

> **Not on npm yet.**

```bash
# try it
npx github:amahmood561/twice

# install it
git clone https://github.com/amahmood561/twice
cd twice && npm link
```

```bash
cd your-notes-repo
twice init            # writes .twice.json and skills/
twice new deploy-the-worker
twice link            # this checkout now owns the symlinks — see below
twice install-hook    # audit on every commit
```

Node 18+. **Zero dependencies.**

---

## Everyday use

```bash
twice new rotate-api-keys            # starts at 1 use, provisional
twice use rotate-api-keys            # did it again — now 2, promoted automatically
twice audit                          # enforce the rule, sync the symlinks
twice list                           # what is live, what is one use away
```

Recording a use with what it taught you:

```bash
twice use rotate-api-keys --gotcha "the dashboard revokes the old key instantly, not after 24h"
```

Gotchas are the part worth having. **Every line under that heading is a bug someone already
paid for once**, and it is the reason a two-use note beats a one-use note by more than double.

---

## The note IS the skill

Established notes are **symlinked**, not copied:

```
your-repo/skills/rotate-api-keys.md  ←──  ~/.claude/skills/rotate-api-keys/SKILL.md
```

One file. Edit it in your editor and you have changed what the agent executes. There is no
second copy to drift, and no sync step to forget.

Frontmatter is what the tool reads:

```markdown
---
name: rotate-api-keys          # must match the filename
description: when to reach for this — this is what makes an agent pick it
times_used: 2
last_used: 2026-09-27
status: established
---
```

---

## `twice link`, and why it exists

**Only a checkout you have explicitly linked will write symlinks.** Everywhere else, `audit`
validates and reports but touches nothing.

That is not caution for its own sake. It is a real incident: the audit ran as a pre-commit
hook, someone cloned the notes repo, and that clone's hook silently re-pointed **every live
skill** at the clone. Nobody chose it — the hook runs on every commit. Deleting the clone left
every skill dangling.

So `twice link` writes `.twice-local.json`, which is gitignored and therefore cannot be
inherited by a clone. A clone still enforces the rule on its own commits. It just never
touches your live skills.

> `twice link` points at your **real** agent skills directory (`~/.claude/skills` by default).
> If you are experimenting, set `target` in `.twice.json` to somewhere harmless first.

---

## What the audit checks

Two categories, and the distinction matters — a check that blocks on style is a check people
delete.

**Problems** (exit 1, blocks a commit):

- `status: established` with fewer than `minUses` uses — the rule, straightforwardly
- An established note with no `description:` — nothing would ever trigger it
- An established note whose `name:` does not match its filename — the symlink would be wrong

**Notes** (never fail anything):

- A note one use away from promotion
- A `status:` value that is neither established nor provisional

Symlinks are only synced when there are **no problems**. A broken state is not half-applied.

---

## Config

`.twice.json` at the repo root. JSON, not YAML — that is what keeps the dependency count at zero.

```json
{
  "skillsDir": "skills",
  "target": "~/.claude/skills",
  "minUses": 2
}
```

`minUses` is yours to set. Two is the argument the name makes, not a law. A malformed config
fails loudly rather than running with defaults.

---

## Commands

```
twice init [--skills-dir skills]     create the config and the skills directory
twice new <name> [--title "..."]     scaffold a note from the template
twice use <name> [--gotcha "..."]    record a use; promotes automatically at the threshold
twice audit [--dry-run] [--no-sync]  enforce the rule and sync symlinks
twice list                           what is established, what is one use away
twice link                           mark THIS checkout as the one that owns the symlinks
twice install-hook                   run the audit on every commit
```

---

## What it does NOT do

- **It does not decide what a skill is.** You write the notes. It counts and it links.
- **It is not a memory store.** No embeddings, no retrieval, no model. Markdown files and symlinks.
- **It does not verify you actually did the thing twice.** `twice use` is an honesty mechanism,
  not an audit trail. Inflating your own counter only fools you.
- **It is not Claude Code specific.** `target` is any directory. It ships with that default
  because that is where it was built.

---

## Why

The failure mode of agent memory is not forgetting. It is remembering everything equally.

A skills directory where a procedure you run weekly sits beside a note about a dependency you
upgraded once in 2025 is a directory nobody opens, and an agent that picks the wrong one. The
promotion rule is the cheapest possible filter: it costs you nothing to write a note, and the
note has to prove itself before it costs the agent anything.

MIT.
