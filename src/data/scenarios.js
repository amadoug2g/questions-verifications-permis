/**
 * scenarios.js — 60 scénarios officiels de l'épreuve "questions dans la voiture".
 * Source : DSR/BRPCE (jan. 2018). Numérotation : 2 derniers chiffres du compteur.
 * IDs 00-60 couverts. Les autres scénarios seront ajoutés progressivement.
 *
 * Chaque objet contient :
 *   id       : "00"–"40"
 *   type1    : "VI" (vérification intérieure) | "VE" (vérification extérieure)
 *   q1/a1    : question et réponse officielle de vérification
 *   explain1 : explication pédagogique (pourquoi c'est important)
 *   photo1   : nom de fichier image dans /public/photos/ (optionnel)
 *   q2/a2    : question et réponse QSER (sécurité routière)
 *   explain2 : explication QSER
 *   q3/a3    : question et réponse premiers secours
 *   explain3 : explication premiers secours
 */

export const SCENARIOS = __SCENARIOS_ARRAY__

export function getScenarioById(id) {
  return SCENARIOS.find(s => s.id === String(id).padStart(2, '0')) || null
}
