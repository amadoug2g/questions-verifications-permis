# VerifPermis

> Les questions « dans la voiture » du permis B, corrigées par l'IA.

**[→ Ouvrir l'app](https://verif-permis.amadou-g.workers.dev)**

---

Depuis 2023, l'examen pratique du permis B comporte 3 questions posées dans le véhicule. Le numéro de scénario correspond aux deux derniers chiffres du compteur kilométrique — 100 scénarios possibles.

Tu tires un scénario, tu réponds librement, une IA évalue. Sans compte. Sans clé API.

## Stack

| | |
|---|---|
| Frontend | Vanilla JS + Vite |
| LLM | Cloudflare Workers AI — Llama 3.3 70B |
| Hébergement | Cloudflare Workers |
| Tests | Vitest — 580 tests |

## Développement

```bash
npm install
npm run dev       # → http://localhost:3000
npm test          # tests unitaires + validation des scénarios contre le PDF officiel
```

## Licence

MIT
