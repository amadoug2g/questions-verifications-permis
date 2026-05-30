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

export const SCENARIOS = [
  {"id":"01","type1":"VI","q1":"Montrez la commande de réglage de hauteur des feux.","a1":"Dispositif situé en général à gauche du volant.","explain1":"Ce correcteur de site adapte l'angle des feux à la charge. Plus la voiture est chargée à l'arrière, plus les feux pointent vers le haut — risque d'éblouir les autres.","photo1":"correcteur-feux.jpg","q2":"Pourquoi doit-on régler la hauteur des feux ?","a2":"Pour ne pas éblouir les autres usagers.","explain2":"Un mauvais réglage réduit la visibilité des conducteurs en face. C'est aussi un point vérifié au contrôle technique.","q3":"Comment et pourquoi protéger une zone de danger en cas d'accident de la route ?","a3":"En délimitant clairement et largement la zone de danger de façon visible pour protéger les victimes et éviter un sur-accident.","explain3":"Le sur-accident est fréquent et mortel. Baliser large et tôt est la priorité AVANT les premiers secours.","video1":"https://www.tiktok.com/@monprofdeconduite/video/7305454500737764641"},
  PLACEHOLDER_REST
]

export function getScenarioById(id) {
  return SCENARIOS.find(s => s.id === String(id).padStart(2, '0')) || null
}
