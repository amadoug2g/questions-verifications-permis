#!/usr/bin/env node
/**
 * extract-from-pdf.js
 * Parser déterministe du fichier texte extrait du PDF officiel DSR/BRPCE.
 * Aucune IA — extraction mécanique basée sur la position des marqueurs.
 *
 * Usage: node scripts/extract-from-pdf.js /tmp/questions.txt
 * Sortie: /tmp/scenarios-raw.json
 */

const fs = require('fs')
const path = require('path')

const inputFile = process.argv[2] || '/tmp/questions.txt'
const outputFile = process.argv[3] || '/tmp/scenarios-raw.json'

const raw = fs.readFileSync(inputFile, 'utf8')

// ─── Nettoyage ────────────────────────────────────────────────────────────
const cleaned = raw
  .replace(/\f/g, '\n')                                        // form feeds
  .replace(/\d{1,2}\s+1er janvier 2018\s+DSR\/BRPCE/g, '')   // pieds de page
  .replace(/DSR\/BRPCE/g, '')

const lines = cleaned.split('\n')

// ─── Helpers ──────────────────────────────────────────────────────────────

// Séparation colonne gauche (question) / droite (réponse) à la colonne ~45
function colSplit(line) {
  const COL = 45
  return [line.slice(0, COL).trim(), line.slice(COL).trim()]
}

function cleanText(arr) {
  return arr
    .filter(s => s.length > 0)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim()
}

// ─── Localisation des scénarios ───────────────────────────────────────────
// Pour chaque ID (00-99), on cherche la position dans le texte du marqueur VI/VE
// qui lui est associé, puis on extrait les sections.

// Map: id -> { viLine, qserLine, secoursLine }
function findStructure(targetId) {
  const padded = String(parseInt(targetId)).padStart(2, '0')
  const results = []

  for (let i = 0; i < lines.length; i++) {
    const s = lines[i].trim()

    // Pattern 1: ID seul sur une ligne  → le VI/VE se trouve AVANT (quelques lignes avant)
    // Pattern 2: ID + VI/VE sur la même ligne → début du scénario
    // Pattern 3: ID dans le texte (mid-Q2) → le VI/VE est AVANT

    let idFound = false
    let typeFromLine = null

    // Cas: "24 VE" ou "21 VI" sur même ligne
    const m1 = s.match(/^(\d{2})\s+(V[IE])\s*$/)
    if (m1 && m1[1] === padded) {
      idFound = true
      typeFromLine = m1[2]
    }

    // Cas: ID seul
    if (s === padded) {
      idFound = true
    }

    // Cas: ID en début de ligne avec du texte (mid-Q2)
    if (s.startsWith(padded + ' ') && !s.match(/V[IE]/)) {
      idFound = true
    }

    if (!idFound) continue

    results.push({ lineIdx: i, typeFromLine })
  }

  return results
}

// Cherche VI ou VE le plus proche avant ou sur la ligne donnée
function findTypeNear(lineIdx) {
  // Cherche dans un fenêtre de 60 lignes avant
  for (let i = lineIdx; i >= Math.max(0, lineIdx - 60); i--) {
    const s = lines[i].trim()
    if (s === 'VI' || s === 'VE') return { type: s, line: i }
    const m = s.match(/^(\d{2})\s+(V[IE])\s*$/)
    if (m) return { type: m[2], line: i }
  }
  return null
}

// Cherche le prochain marqueur QSER après une ligne
function findQSER(fromLine) {
  for (let i = fromLine; i < Math.min(fromLine + 50, lines.length); i++) {
    if (lines[i].trim().startsWith('QSER')) return i
  }
  return -1
}

// Cherche le prochain "1ers secours" après une ligne
function findSecours(fromLine) {
  for (let i = fromLine; i < Math.min(fromLine + 50, lines.length); i++) {
    if (lines[i].trim().startsWith('1ers secours')) return i
  }
  return -1
}

// Cherche la ligne "Réponse" sur la même ligne ou la suivante d'un marqueur section
function findReponseNear(sectionLine) {
  for (let i = sectionLine; i < Math.min(sectionLine + 3, lines.length); i++) {
    if (lines[i].includes('Réponse') || lines[i].includes('Réponse')) return i
  }
  return sectionLine
}

// Extrait Q et A entre deux bornes de lignes
function extractQA(fromLine, toLine) {
  const qParts = []
  const aParts = []
  for (let i = fromLine; i < Math.min(toLine, lines.length); i++) {
    const line = lines[i]
    const s = line.trim()
    // Ignorer marqueurs de section et numéros de page
    if (s === 'QSER' || s === 'Réponse' || s.startsWith('1ers secours') ||
        s === 'VI' || s === 'VE' || s.match(/^\d{1,2}\s+1er janvier/) ||
        (s.match(/^\d{2}$/) && parseInt(s) < 100) ||
        s.match(/^\d{2}\s+V[IE]$/) ||
        s.match(/^\d{2}\s+V[IE]\s+/) ) {
      continue
    }
    // Ignorer les lignes où QSER et Réponse sont sur la même ligne (c'est un header)
    if (s.includes('QSER') && s.includes('Réponse')) continue
    if (s.includes('1ers secours') && s.includes('Réponse')) continue

    const [left, right] = colSplit(line)

    // Supprimer l'ID en début de ligne dans le texte Q
    const leftClean = left.replace(/^\d{2}\s+/, '')

    if (leftClean) qParts.push(leftClean)
    if (right && !right.match(/^R[ée]ponse$/i)) aParts.push(right)
  }

  return [cleanText(qParts), cleanText(aParts)]
}

// ─── Extraction principale ────────────────────────────────────────────────

function extractScenario(id) {
  const positions = findStructure(id)
  if (positions.length === 0) {
    console.error(`⚠ ID ${id} non trouvé`)
    return null
  }

  const { lineIdx, typeFromLine } = positions[0]

  // Trouver VI/VE
  let type1, viLine
  if (typeFromLine) {
    type1 = typeFromLine
    viLine = lineIdx
  } else {
    const found = findTypeNear(lineIdx)
    if (!found) {
      // Cherche aussi après l'ID
      for (let i = lineIdx; i < Math.min(lineIdx + 10, lines.length); i++) {
        const s = lines[i].trim()
        if (s === 'VI' || s === 'VE') { type1 = s; viLine = i; break }
      }
    } else {
      type1 = found.type
      viLine = found.line
    }
  }

  if (!type1) {
    console.error(`⚠ Type VI/VE introuvable pour ${id}`)
    return null
  }

  // Trouver QSER (peut être avant ou après l'ID selon la position)
  // Cherche dans une fenêtre large autour de la position VI/VE
  const qserLine = findQSER(viLine + 1)
  if (qserLine === -1) {
    console.error(`⚠ QSER introuvable pour ${id}`)
    return null
  }

  // Trouver 1ers secours
  const secoursLine = findSecours(qserLine + 1)
  if (secoursLine === -1) {
    console.error(`⚠ 1ers secours introuvable pour ${id}`)
    return null
  }

  // Trouver la fin du scénario (prochain VI/VE ou fin du fichier)
  let endLine = secoursLine + 30
  for (let i = secoursLine + 3; i < Math.min(secoursLine + 35, lines.length); i++) {
    const s = lines[i].trim()
    if (s === 'VI' || s === 'VE' || s.match(/^\d{2}\s+V[IE]/)) {
      endLine = i
      break
    }
  }

  // Extraire Q1/A1 (entre viLine+1 et qserLine)
  const [q1, a1] = extractQA(viLine + 1, qserLine)

  // Extraire Q2/A2 (entre qserLine+1 et secoursLine)
  const reponse1Line = findReponseNear(qserLine)
  const [q2, a2] = extractQA(reponse1Line + 1, secoursLine)

  // Extraire Q3/A3 (entre secoursLine+1 et endLine)
  const reponse2Line = findReponseNear(secoursLine)
  const [q3, a3] = extractQA(reponse2Line + 1, endLine)

  return { id, type1, q1, a1, q2, a2, q3, a3 }
}

// ─── IDs à extraire ───────────────────────────────────────────────────────
const ALL_IDS = [
  '00', '01', '02', '03', '04', '05', '06', '07', '08', '09',
  '10', '11', '12', '13', '14', '15', '16', '17', '18', '19',
  '20', '21', '22', '23', '24', '25', '26', '27', '28', '29',
  '30', '31', '32', '33', '34', '35', '36', '37', '38', '39',
  '40', '41', '42', '43', '44', '45', '46', '47', '48', '49',
  '50', '51', '52', '53', '54', '55', '56', '57', '58', '59',
  '60',
]

const results = {}
let errors = 0

for (const id of ALL_IDS) {
  const s = extractScenario(id)
  if (!s) { errors++; continue }
  if (!s.q1 || !s.a1 || !s.q2 || !s.a2 || !s.q3 || !s.a3) {
    console.error(`⚠ Données incomplètes pour scénario ${id}:`, {
      q1: s.q1?.slice(0, 30),
      a1: s.a1?.slice(0, 30),
      q2: s.q2?.slice(0, 30),
      a2: s.a2?.slice(0, 30),
      q3: s.q3?.slice(0, 30),
      a3: s.a3?.slice(0, 30),
    })
    errors++
  }
  results[id] = s
}

fs.writeFileSync(outputFile, JSON.stringify(Object.values(results), null, 2))
console.log(`\n✓ ${Object.keys(results).length} scénarios extraits → ${outputFile}`)
if (errors > 0) console.error(`⚠ ${errors} erreurs détectées`)
else console.log('✓ Aucune erreur')
