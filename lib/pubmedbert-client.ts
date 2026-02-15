/**
 * Client for the PubMedBERT embedding service.
 * Used for guideline alignment: compare target model responses to guideline snippets.
 *
 * Set PUBMEDBERT_SERVICE_URL (e.g. http://localhost:8000) in .env.local.
 * Run the service: cd services/pubmedbert && pip install -r requirements.txt && uvicorn app:app --port 8000
 */

import { getGuidelineSnippet } from "@/lib/guidelines"
import type { FailureModeId } from "@/lib/types"

const BASE_URL = process.env.PUBMEDBERT_SERVICE_URL ?? "http://localhost:8000"

export interface AlignmentResult {
  responseId: string
  failureMode: FailureModeId
  rawSimilarity: number
  /** 0–100 score: 50 + 50 * similarity (so 0.8 similarity → 90) */
  alignmentScore: number
}

/**
 * Compute cosine similarity between one reference and many candidates.
 * Uses the /similarity endpoint (reference + candidates).
 */
export async function similarity(
  reference: string,
  candidates: string[]
): Promise<number[]> {
  if (candidates.length === 0) return []
  const res = await fetch(`${BASE_URL}/similarity`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ reference, candidates }),
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`PubMedBERT similarity failed: ${res.status} ${err}`)
  }
  const data = (await res.json()) as { similarities: number[] }
  return data.similarities
}

/**
 * Embed a list of texts. Returns L2-normalized vectors (768-d).
 * Use when you need raw embeddings (e.g. for your own similarity logic).
 */
export async function embed(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return []
  const res = await fetch(`${BASE_URL}/embed`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ texts }),
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`PubMedBERT embed failed: ${res.status} ${err}`)
  }
  const data = (await res.json()) as { embeddings: number[][] }
  return data.embeddings
}

/**
 * Check if the PubMedBERT service is reachable.
 */
export async function healthCheck(): Promise<boolean> {
  try {
    const res = await fetch(`${BASE_URL}/health`)
    return res.ok
  } catch {
    return false
  }
}

/**
 * Compute guideline alignment for a list of responses.
 * Each response is compared to the guideline snippet for its failure mode.
 * Returns alignment results; if the service is down, returns empty array (caller can skip or fallback).
 */
export async function computeGuidelineAlignment(
  responses: {
    questionId: string
    failureMode: FailureModeId
    turns: { role: string; content: string }[]
  }[]
): Promise<AlignmentResult[]> {
  if (responses.length === 0) return []

  const up = await healthCheck()
  if (!up) return []

  const results: AlignmentResult[] = []

  // Get last assistant turn (target model's final response) per response
  const texts = responses.map((r) => {
    const assistantTurns = r.turns.filter((t) => t.role === "assistant")
    const last = assistantTurns[assistantTurns.length - 1]
    return last?.content ?? ""
  })

  // Group by failure mode to batch: one reference per failure mode, many candidates
  const byMode = new Map<FailureModeId, { index: number; text: string }[]>()
  responses.forEach((r, i) => {
    const list = byMode.get(r.failureMode) ?? []
    list.push({ index: i, text: texts[i] })
    byMode.set(r.failureMode, list)
  })

  for (const [failureMode, items] of byMode) {
    const reference = getGuidelineSnippet(failureMode)
    const candidates = items.map((x) => x.text)
    const sims = await similarity(reference, candidates)
    for (let j = 0; j < items.length; j++) {
      const raw = sims[j]
      const alignmentScore = Math.round(50 + 50 * raw)
      results.push({
        responseId: responses[items[j].index].questionId,
        failureMode,
        rawSimilarity: raw,
        alignmentScore: Math.min(100, Math.max(0, alignmentScore)),
      })
    }
  }

  return results
}
