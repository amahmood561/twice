// A deliberately small frontmatter reader. It handles `key: value` and nothing
// else, because that is all a skill note needs — and pulling in a YAML parser
// to read six scalars is how a tool acquires a supply chain.

export function parse(text) {
  const m = /^---\r?\n([\s\S]*?)\r?\n---/.exec(text);
  if (!m) return { data: {}, body: text, raw: null };
  const data = {};
  for (const line of m[1].split(/\r?\n/)) {
    const at = line.indexOf(":");
    if (at === -1 || line.trimStart().startsWith("#")) continue;
    const key = line.slice(0, at).trim();
    let value = line.slice(at + 1).trim();
    if (/^-?\d+$/.test(value)) value = Number(value);
    else value = value.replace(/^["'](.*)["']$/, "$1");
    if (key) data[key] = value;
  }
  return { data, body: text.slice(m[0].length).replace(/^\r?\n/, ""), raw: m[1] };
}

/** Rewrite a single frontmatter field in place, preserving everything else. */
export function setField(text, key, value) {
  const m = /^---\r?\n([\s\S]*?)\r?\n---/.exec(text);
  if (!m) return text;
  const line = `${key}: ${value}`;
  const re = new RegExp(`^${key}:.*$`, "m");
  const block = re.test(m[1]) ? m[1].replace(re, line) : m[1] + "\n" + line;
  return text.slice(0, m.index) + `---\n${block}\n---` + text.slice(m.index + m[0].length);
}
