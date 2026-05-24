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
  return `Question posée au candidat :
"${question}"

Réponse officielle attendue :
"${officialAnswer}"
${context ? `\nContexte pédagogique : ${context}\n` : ''}
Réponse du candidat :
"${userAnswer}"

Évalue si la réponse est correcte. Réponds UNIQUEMENT en JSON valide :
{"score": 1, "label": "Correct", "comment": "..."}
ou
{"score": 0, "label": "Partiel", "comment": "..."}
ou
{"score": 0, "label": "Incorrect", "comment": "..."}

Règles :
- score 1 si le fond est juste (même si formulation imparfaite)
- label "Partiel" si réponse incomplète mais pas fausse
- comment : 1-2 phrases en français, pédagogiques et bienveillantes`
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
