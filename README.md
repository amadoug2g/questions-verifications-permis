# Questions de vérification - Permis B

> Comprends le mécanisme, entraîne-toi sur les 100 scénarios. Zéro compte, zéro installation, zéro friction.

---

Depuis janvier 2023, l'examen pratique du permis B comporte trois questions de vérification posées dans le véhicule. Le numéro de scénario est déterminé par les deux derniers chiffres du compteur kilométrique — soit 100 scénarios possibles.

Cette application simule l'épreuve en entier : tu tires un scénario au hasard, tu réponds aux trois questions, et une IA évalue tes réponses avec un commentaire pédagogique. Sans compte. Sans clé API à configurer.

## Comment ça marche

```
[Simuler le compteur]
        │
        ▼
[Scénario tiré au sort — 2 derniers chiffres]
        │
        ▼
[3 questions : Vérification · Sécurité routière · Premiers secours]
        │
        ▼
[Tu réponds librement par écrit]
        │
        ▼
[L'IA évalue et explique]
        │
        ▼
[Score sur 3 · Comprendre pourquoi]
```

## Fonctionnalités

- **Odomètre animé** — simule les deux derniers chiffres du compteur du véhicule d'examen
- **100 scénarios officiels** — couvrant toutes les combinaisons de questions de l'épreuve
- **3 types de questions** — Vérification Intérieure (VI), Vérification Extérieure (VE), Sécurité Routière (QSER), Premiers Secours (SEC)
- **Évaluation IA gratuite** — aucune clé API nécessaire, l'évaluation est prise en charge côté serveur
- **Mode démo** — simulation réaliste du retour IA, même sans connexion à un modèle
- **Explication pédagogique** — chaque question dispose d'un bloc "Comprendre pourquoi" pour ancrer la connaissance
- **Historique de sessions** — suivi du score cumulé sur toutes les sessions
- **Zéro compte** — aucune inscription, aucune donnée transmise

## Composition d'un scénario

Chaque scénario comporte exactement trois questions, dans cet ordre :

| # | Type | Thème |
|---|------|-------|
| Q1 | VI ou VE | Vérification d'un élément du véhicule (intérieur ou extérieur) |
| Q2 | QSER | Sécurité routière liée à la vérification précédente |
| Q3 | SEC | Premiers secours |

Les mauvaises réponses **ne sont pas éliminatoires**. Chaque bonne réponse vaut **1 point**, pour un total de **3 points** qui s'ajoutent aux 20 points de la phase de conduite.

## Pile technique

| Couche | Choix | Raison |
|--------|-------|--------|
| Frontend | Vite + Vanilla JS (ES Modules) | Léger, sans framework, déployable partout |
| LLM | Cloudflare Workers AI — Llama 3.1 8B | Gratuit, sans clé côté utilisateur |
| Hébergement | Cloudflare Pages | Free tier généreux, edge, HTTPS inclus |
| Données | `src/data/scenarios.js` | 100 scénarios statiques, pas de base de données |
| État | `localStorage` | Historique de sessions sans compte |

## Structure du projet

```
questions-verifications-permis/
├── index.html                  # Shell HTML + CSS intégré (thème sombre)
├── src/
│   ├── main.js                 # Point d'entrée — câblage des modules
│   ├── core/
│   │   ├── QuizEngine.js       # Logique de session, scores, événements
│   │   └── LLMService.js       # Appels IA — proxy serveur ou mock local
│   ├── components/
│   │   ├── Odometer.js         # Odomètre animé
│   │   ├── QuestionCard.js     # Carte de question avec évaluation IA
│   │   └── ScoreBoard.js       # Score en cours + récapitulatif final
│   ├── data/
│   │   └── scenarios.js        # Les 100 scénarios (questions + réponses + explications)
│   └── utils/
│       └── storage.js          # Persistance localStorage (stats, préférences)
├── functions/
│   └── api/
│       └── evaluate.js         # Cloudflare Pages Function — proxy vers Workers AI
├── package.json
└── vite.config.js
```

## Lancer en local

### Prérequis

- Node.js 22+ (`nvm use 22`)
- Aucune clé API nécessaire pour le mode démo

### Démarrer

```bash
git clone https://github.com/amadoug2g/questions-verifications-permis.git
cd questions-verifications-permis
NODE_ENV=development npm install
npm run dev
# → http://localhost:3000
```

Sans clé API configurée, l'évaluation fonctionne en **mode démo** : délai simulé, commentaire réaliste, badge "Mode démo" visible.

### Avec évaluation IA réelle (optionnel)

Ouvre les paramètres dans l'app, choisis ton fournisseur (Anthropic ou OpenAI) et colle ta clé. Elle est stockée uniquement dans ton navigateur, jamais transmise à un tiers.

## Déploiement

L'app est déployée sur **Cloudflare Pages** avec un Worker qui proxifie les appels vers Cloudflare Workers AI — aucune clé API à exposer côté client.

```bash
npm run build
wrangler pages deploy dist --project-name=questions-verifications-permis
```

Le déploiement est automatisé via l'intégration GitHub de Cloudflare Pages : chaque `git push` sur `main` déclenche un build et un déploiement.

## Feuille de route

### Fait

- [x] Odomètre animé avec tirage aléatoire de scénario
- [x] 3 types de questions par scénario (VI, VE, QSER, SEC)
- [x] Évaluation IA avec retour pédagogique
- [x] Mode démo sans clé API (simulation réaliste avec délai)
- [x] Historique de sessions (score cumulé)
- [x] Thème sombre, responsive mobile

### À venir

- [ ] Déploiement Cloudflare Pages + Workers AI (évaluation gratuite)
- [ ] Complétion des 100 scénarios (actuellement ~20)
- [ ] Section "Comment ça marche" — explication du mécanisme d'examen
- [ ] Section "Composition des questions" — guide pédagogique
- [ ] Photos des éléments à vérifier (VI/VE)
- [ ] Migration vers SvelteKit pour la navigation multi-sections
- [ ] GitHub Pages pour la landing page

## Licence

MIT
