/**
 * UMLS REST API client for concept search and validation.
 * Base URI: https://uts-ws.nlm.nih.gov/rest
 * Docs: https://documentation.uts.nlm.nih.gov/rest/home.html
 *
 * NLM requires an API key for all REST requests. Get a free key at
 * https://uts.nlm.nih.gov/uts/profile (create account, accept license, generate key).
 * Set UMLS_API_KEY in .env.local. If unset, search/validation return empty (UMLS
 * checks are skipped and the app still runs).
 */

const BASE = "https://uts-ws.nlm.nih.gov/rest"

function getApiKey(): string | undefined {
  return process.env.UMLS_API_KEY
}

export interface UmlsSearchResult {
  ui: string
  rootSource: string
  name: string
  uri?: string
}

/**
 * Search UMLS by term. Returns concepts (CUI + name) for vocabulary cross-reference.
 * GET /search/current?string=...&apiKey=...&pageSize=200
 */
export async function search(term: string): Promise<UmlsSearchResult[]> {
  const apiKey = getApiKey()
  if (!apiKey) return []
  const encoded = encodeURIComponent(term.trim())
  const url = `${BASE}/search/current?string=${encoded}&pageSize=200&apiKey=${apiKey}`
  const res = await fetch(url)
  if (!res.ok) return []
  const data = (await res.json()) as { result?: { results?: UmlsSearchResult[] } }
  return data.result?.results ?? []
}

/**
 * Check if a concept term exists in UMLS (at least one match).
 */
export async function conceptExists(term: string): Promise<boolean> {
  const results = await search(term)
  return results.length > 0
}

/**
 * Validate multiple terms; returns count valid and total.
 */
export async function validateConcepts(terms: string[]): Promise<{ valid: number; total: number; details: { term: string; found: boolean }[] }> {
  const details: { term: string; found: boolean }[] = []
  for (const term of terms) {
    if (!term.trim()) continue
    const found = await conceptExists(term)
    details.push({ term: term.trim(), found })
  }
  const total = details.length
  const valid = details.filter((d) => d.found).length
  return { valid, total, details }
}
