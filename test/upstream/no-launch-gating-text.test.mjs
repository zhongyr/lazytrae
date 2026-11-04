import { execFileSync } from "node:child_process"
import { readFileSync, statSync } from "node:fs"
import test from "node:test"
import assert from "node:assert/strict"

const SEARCH_ROOTS = ["README.md", "packages/web/"]
const IGNORED_PREFIXES = [".omo/"]
const BANNED_WORD_GROUPS = [
  ["coming", "soon"],
  ["coming", "june"],
  ["currently", "available", "for", "opencode"],
  ["codex", "edition", "is", "coming"],
  ["wait" + "list"],
]

function trackedFiles() {
  return execFileSync("git", ["ls-files"], { encoding: "utf8" })
    .split("\n")
    .filter((file) => file.length > 0)
    .filter((file) => SEARCH_ROOTS.some((root) => file === root || file.startsWith(root)))
    .filter((file) => !IGNORED_PREFIXES.some((prefix) => file.startsWith(prefix)))
}

function isBinary(buffer) {
  return buffer.includes(0)
}

test("public LazyCodex surfaces do not contain launch gating copy", () => {
  const offenders = []

  for (const file of trackedFiles()) {
    const stat = statSync(file, { throwIfNoEntry: false })
    if (!stat?.isFile()) continue

    const buffer = readFileSync(file)
    if (isBinary(buffer)) continue

    const text = buffer.toString("utf8").toLowerCase()
    for (const group of BANNED_WORD_GROUPS) {
      const phrase = group.join(" ")
      if (text.includes(phrase)) offenders.push(`${file}: ${phrase}`)
    }
  }

  assert.deepEqual(offenders, [], `launch gating copy remains: ${offenders.join(", ")}`)
})
