/**
 * UMLS concept validation: extract medical terms from model responses,
 * validate against UMLS (https://uts-ws.nlm.nih.gov/rest). Per-response and per failure mode.
 * POST { responses: { questionId, failureMode, text }[] }
 */

import { generateText, Output } from "ai";
import { getClaudeModel } from "@/lib/ai-claude";
import { z } from "zod";
import { validateConcepts } from "@/lib/umls-client";

const extractSchema = z.object({
  terms: z.array(z.string()).describe("List of distinct medical/clinical terms or concepts mentioned (drugs, conditions, procedures, etc.). No duplicates."),
});

export async function POST(req: Request) {
  try {
    const { responses } = (await req.json()) as {
      responses: { questionId: string; failureMode: string; text: string }[];
    };
    if (!Array.isArray(responses) || responses.length === 0) {
      return Response.json(
        { error: "responses array required" },
        { status: 400 }
      );
    }

    const perResponse: { questionId: string; failureMode: string; validConcepts: number; totalConcepts: number; scorePct: number }[] = [];
    const conceptCache = new Map<string, boolean>();

    for (const r of responses) {
      const text = (r.text ?? "").slice(0, 4000);
      if (!text.trim()) {
        perResponse.push({ questionId: r.questionId, failureMode: r.failureMode, validConcepts: 0, totalConcepts: 0, scorePct: 0 });
        continue;
      }

      const extractResult = await generateText({
        model: getClaudeModel(),
        output: Output.object({ schema: extractSchema }),
        system: "You extract medical/clinical terms from text: drug names, conditions, procedures, anatomy, etc. Output a 'terms' array of distinct strings. No explanations.",
        prompt: `Extract all distinct medical/clinical terms from:\n\n${text}`,
      });
      const terms = [...new Set((extractResult.output.terms ?? []).filter(Boolean).map((t: string) => t.trim()).slice(0, 30))];
      if (terms.length === 0) {
        perResponse.push({ questionId: r.questionId, failureMode: r.failureMode, validConcepts: 0, totalConcepts: 0, scorePct: 100 });
        continue;
      }

      const toCheck = terms.filter((t) => !conceptCache.has(t));
      if (toCheck.length > 0) {
        const { details } = await validateConcepts(toCheck);
        for (const d of details) conceptCache.set(d.term, d.found);
      }
      const valid = terms.filter((t) => conceptCache.get(t) === true).length;
      const total = terms.length;
      const scorePct = total > 0 ? (valid / total) * 100 : 100;
      perResponse.push({ questionId: r.questionId, failureMode: r.failureMode, validConcepts: valid, totalConcepts: total, scorePct });
    }

    const byMode = new Map<string, { sum: number; count: number; n: number }>();
    for (const p of perResponse) {
      if (!byMode.has(p.failureMode)) byMode.set(p.failureMode, { sum: 0, count: 0, n: 0 });
      const m = byMode.get(p.failureMode)!;
      m.n += 1;
      m.sum += p.scorePct;
      m.count += 1;
    }
    const perFailureMode = Array.from(byMode.entries()).map(([failureMode, v]) => ({
      failureMode,
      avgScorePct: v.count > 0 ? v.sum / v.count : 0,
      responseCount: v.n,
    }));

    return Response.json({
      data: {
        perResponse,
        perFailureMode,
        summary: `UMLS concept validation: ${perResponse.length} responses, avg ${(perResponse.reduce((a, x) => a + x.scorePct, 0) / (perResponse.length || 1)).toFixed(1)}% valid concepts.`,
      },
    });
  } catch (error) {
    console.error("UMLS validate error:", error);
    return Response.json(
      { error: error instanceof Error ? error.message : "UMLS validation failed" },
      { status: 500 }
    );
  }
}
