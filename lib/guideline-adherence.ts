/**
 * Guideline adherence: keyword + optional LLM. Uses data/clinical-guidelines.json
 * (5 guidelines: heart failure, diabetes, hypertension, atrial fibrillation, pneumonia)
 * with Class I recommendations. Scores per guideline: matched/total.
 */

import path from "path";
import { readFileSync } from "fs";

function loadGuidelinesData(): { guidelines: Guideline[] } {
  const p = path.join(process.cwd(), "data", "clinical-guidelines.json");
  const raw = readFileSync(p, "utf-8");
  return JSON.parse(raw) as { guidelines: Guideline[] };
}

export interface GuidelineRec {
  class: string;
  text: string;
  source: string;
}

export interface Guideline {
  id: string;
  label: string;
  source: string;
  recommendations: GuidelineRec[];
}

export interface GuidelineAdherenceResult {
  guideline: string;
  label: string;
  matched: number;
  total: number;
  adherenceScore: number;
  details: string[];
}

function tokenize(s: string): string[] {
  return s
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2);
}

/** Keyword match: recommendation is "matched" if at least 2 significant words from it appear in the response. */
function recommendationMatches(responseText: string, rec: GuidelineRec): boolean {
  const responseTokens = new Set(tokenize(responseText));
  const recTokens = tokenize(rec.text).filter((w) => w.length > 4);
  if (recTokens.length === 0) return false;
  const matchCount = recTokens.filter((t) => responseTokens.has(t)).length;
  return matchCount >= Math.min(2, Math.ceil(recTokens.length * 0.2));
}

let _cached: Guideline[] | null = null;
export function getGuidelines(): Guideline[] {
  if (!_cached) _cached = loadGuidelinesData().guidelines ?? [];
  return _cached;
}

/**
 * Compute guideline adherence for a single response (keyword-based).
 * Returns per-guideline matched/total and score.
 */
export function computeAdherenceForResponse(responseText: string): GuidelineAdherenceResult[] {
  const guidelines = getGuidelines();
  const results: GuidelineAdherenceResult[] = [];
  for (const g of guidelines) {
    const classI = g.recommendations.filter((r) => r.class === "I");
    let matched = 0;
    const details: string[] = [];
    for (const rec of classI) {
      if (recommendationMatches(responseText, rec)) {
        matched++;
        details.push(rec.text.slice(0, 80) + "...");
      }
    }
    results.push({
      guideline: g.id,
      label: g.label,
      matched,
      total: classI.length,
      adherenceScore: classI.length > 0 ? (matched / classI.length) * 100 : 0,
      details,
    });
  }
  return results;
}

/**
 * Aggregate adherence across multiple responses (average score per guideline).
 */
export function aggregateAdherence(
  perResponseResults: GuidelineAdherenceResult[][]
): GuidelineAdherenceResult[] {
  if (perResponseResults.length === 0) return [];
  const byGuideline = new Map<string, { scoreSum: number; total: number; matchedSum: number; details: string[]; label: string }>();
  for (const res of perResponseResults) {
    for (const g of res) {
      if (!byGuideline.has(g.guideline)) {
        byGuideline.set(g.guideline, { scoreSum: 0, total: g.total, matchedSum: 0, details: [], label: g.label });
      }
      const agg = byGuideline.get(g.guideline)!;
      agg.scoreSum += g.adherenceScore;
      agg.matchedSum += g.matched;
      if (g.details.length) agg.details.push(...g.details.slice(0, 2));
    }
  }
  const n = perResponseResults.length;
  return Array.from(byGuideline.entries()).map(([guideline, v]) => ({
    guideline,
    label: v.label,
    matched: Math.round((v.matchedSum / n) * 10) / 10,
    total: v.total,
    adherenceScore: n > 0 ? v.scoreSum / n : 0,
    details: [...new Set(v.details)].slice(0, 5),
  }));
}
