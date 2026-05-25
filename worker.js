/**
 * worker.js — Cloudflare Worker
 * Route /api/evaluate → Workers AI (Llama 3.1 8B, gratuit)
 * Tout le reste → assets statiques (build Vite dans /dist)
 */

export default {
  async fetch(request, env) {
    const url = new URL(request.url)

    // ── CORS preflight ────────────────────────────────────────────────────
    if (request.method === 'OPTIONS') {
      return corsResponse(null, 204)
    }

    // ── Route : POST /api/evaluate ────────────────────────────────────────
    if (url.pathname === '/api/evaluate' && request.method === 'POST') {
      return handleEvaluate(request, env)
    }

    // ── Assets statiques (SPA Vite) ───────────────────────────────────────
    return env.ASSETS.fetch(request)
  },
}

// ─── Handler évaluation ───────────────────────────────────────────────────

async function handleEvaluate(request, env) {
  try {
    const body = await request.json()
    const { question, officialAnswer, userAnswer, context = '' } = body

    if (!question || !officialAnswer || !userAnswer) {
      return corsResponse({ error: 'Paramètres manquants' }, 400)
    }

    const prompt = buildEvalPrompt({ question, officialAnswer, userAnswer, context })

    const aiResponse = await env.AI.run('@cf/meta/llama-3.1-8b-instruct', {
      messages: [
        {
          role: 'system',
          content:
            'Tu es un examinateur bienveillant du permis de conduire français. ' +
            'Tu réponds UNIQUEMENT en JSON valide, sans texte avant ou après.',
        },
        { role: 'user', content: prompt },
      ],
      max_tokens: 256,
    })

    const text = aiResponse?.response ?? ''
    return corsResponse({ text })
  } catch (err) {
    console.error('evaluate error:', err)
    return corsResponse({ error: err.message ?? 'Erreur interne' }, 500)
  }
}

// ─── Prompt ───────────────────────────────────────────────────────────────

function buildEvalPrompt({ question, officialAnswer, userAnswer, context }) {
  return `Évalue si la réponse du candidat couvre les points essentiels de la réponse officielle.

Question :
"${question}"

Réponse officielle :
"${officialAnswer}"
${context ? `\nContexte : ${context}\n` : ''}
Réponse du candidat :
"${userAnswer}"

RÈGLES :
1. Ignore orthographe, style et ordre des mots — seul le fond compte.
2. label "Correct" (score 1) : tous les éléments essentiels sont présents.
3. label "Partiel" (score 0) : des éléments essentiels sont présents mais d'autres manquent.
4. label "Incorrect" (score 0) : réponse fausse ou hors-sujet.

RÈGLE ABSOLUE : si label = "Correct", le comment doit être affirmatif SANS "mais", "cependant", "toutefois" ni suggestion de compléter. Si tu ressens le besoin d'ajouter un "mais", utilise "Partiel" à la place.

Réponds UNIQUEMENT en JSON valide, un seul objet, sans texte autour :
{"score": 1, "label": "Correct", "comment": "Bonne réponse — [confirmation courte du point clé]."}
ou
{"score": 0, "label": "Partiel", "comment": "Il manque [élément précis]. La réponse complète inclut aussi [complément]."}
ou
{"score": 0, "label": "Incorrect", "comment": "La réponse attendue est : [point clé]. [Explication en 1 phrase pourquoi c'est important.]"}`
}

// ─── Helpers CORS ─────────────────────────────────────────────────────────

function corsResponse(data, status = 200) {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  }
  return new Response(data !== null ? JSON.stringify(data) : null, { status, headers })
}
