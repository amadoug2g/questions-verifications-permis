/**
 * annotate-required-count.mjs — script one-shot
 *
 * Détecte les quantificateurs explicites dans les questions des scénarios
 * ("citez un", "citez deux", "les trois informations"...) et écrit
 * requiredCount1/2/3 dans src/data/scenarios.js.
 *
 * Usage : node scripts/annotate-required-count.mjs [--dry-run]
 */

import { readFileSync, writeFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dir  = dirname(fileURLToPath(import.meta.url))
const TARGET = join(__dir, '../src/data/scenarios.js')
const DRY    = process.argv.includes('--dry-run')

// ─── Détection du quantificateur ─────────────────────────────────────────────

const WORDS = { un: 1, une: 1, deux: 2, trois: 3, quatre: 4 }
const NUM_PAT = '(un|une|deux|trois|quatre)'

const PATTERNS = [
  // "citez un/deux/...", "nommez un", "indiquez un"
  new RegExp(`\\b(?:citez|nommez|indiquez)\\s+${NUM_PAT}\\b`, 'i'),
  // "donnez un exemple"
  new RegExp(`\\bdonnez\\s+${NUM_PAT}\\b`, 'i'),
  // "les deux documents", "les trois informations", "les deux autres"
  new RegExp(`\\bles\\s+${NUM_PAT}\\b`, 'i'),
]

function detectRequiredCount(question) {
  for (const pat of PATTERNS) {
    const m = question.match(pat)
    if (m) return WORDS[m[1].toLowerCase()] ?? null
  }
  return null
}

// ─── Import dynamique des scénarios ──────────────────────────────────────────

const { SCENARIOS } = await import('../src/data/scenarios.js')

// ─── Annotation ──────────────────────────────────────────────────────────────

let changed = 0
const updated = SCENARIOS.map(s => {
  const rc1 = detectRequiredCount(s.q1)
  const rc2 = detectRequiredCount(s.q2)
  const rc3 = detectRequiredCount(s.q3)

  const out = { ...s }
  if (rc1 !== null) { out.requiredCount1 = rc1; changed++ }
  if (rc2 !== null) { out.requiredCount2 = rc2; changed++ }
  if (rc3 !== null) { out.requiredCount3 = rc3; changed++ }

  if (rc1 !== null || rc2 !== null || rc3 !== null) {
    console.log(`[${s.id}] Q1:${rc1 ?? '–'} Q2:${rc2 ?? '–'} Q3:${rc3 ?? '–'}`)
    if (rc1 !== null) console.log(`       Q1: "${s.q1.slice(0, 70)}"`)
    if (rc2 !== null) console.log(`       Q2: "${s.q2.slice(0, 70)}"`)
    if (rc3 !== null) console.log(`       Q3: "${s.q3.slice(0, 70)}"`)
  }
  return out
})

console.log(`\n${changed} champ(s) requiredCount détectés sur ${SCENARIOS.length} scénarios.`)

if (DRY) {
  console.log('\n--dry-run : aucune écriture.')
  process.exit(0)
}

// ─── Réécriture du fichier ────────────────────────────────────────────────────

const source = readFileSync(TARGET, 'utf8')
const header = source.match(/^[\s\S]*?(?=export const SCENARIOS)/)[0]
const footer = source.match(/\]\s*\n([\s\S]*)$/)?.[1] ?? ''

const body = `export const SCENARIOS = ${JSON.stringify(updated, null, 2)
  .replace(/{\n\s+"id"/g, '{"id"')
  .replace(/,\n\s+"type1"/g, ',"type1"')
  .replace(/,\n\s+"q1"/g, ',"q1"')
  .replace(/,\n\s+"a1"/g, ',"a1"')
  .replace(/,\n\s+"requiredCount1"/g, ',"requiredCount1"')
  .replace(/,\n\s+"explain1"/g, ',"explain1"')
  .replace(/,\n\s+"photo1"/g, ',"photo1"')
  .replace(/,\n\s+"q2"/g, ',"q2"')
  .replace(/,\n\s+"a2"/g, ',"a2"')
  .replace(/,\n\s+"requiredCount2"/g, ',"requiredCount2"')
  .replace(/,\n\s+"explain2"/g, ',"explain2"')
  .replace(/,\n\s+"q3"/g, ',"q3"')
  .replace(/,\n\s+"a3"/g, ',"a3"')
  .replace(/,\n\s+"requiredCount3"/g, ',"requiredCount3"')
  .replace(/,\n\s+"explain3"/g, ',"explain3"')
  .replace(/\n\s+}/g, '}')
}\n`

writeFileSync(TARGET, header + body + footer)
console.log(`\nscenarios.js mis à jour.`)
