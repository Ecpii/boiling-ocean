/**
 * PubMed search agent: parses model response with LLM, formulates PubMed
 * queries, runs Entrez ESearch (and optionally EFetch) to cross-reference.
 * POST { responseText: string } → { queries: string[], papers: PubMedArticle[] }
 */

import { generateText, Output } from "ai";
import { getClaudeModel } from "@/lib/ai-claude";
import { z } from "zod";
import { esearch, efetchAbstracts, type PubMedArticle } from "@/lib/pubmed-entrez";

const querySchema = z.object({
  queries: z.array(z.string()).describe("1–3 PubMed search queries (Entrez style) to find papers that support or refute the claims in the response"),
});

const MAX_QUERIES = 3;
const PAPERS_PER_QUERY = 5;
const MAX_TOTAL_PAPERS = 10;

export async function POST(req: Request) {
  try {
    const { responseText } = (await req.json()) as { responseText: string };
    if (!responseText || typeof responseText !== "string") {
      return Response.json(
        { error: "responseText (string) is required" },
        { status: 400 }
      );
    }

    const result = await generateText({
      model: getClaudeModel(),
      output: Output.object({ schema: querySchema }),
      system: `You are a medical literature expert. Given an AI model's response about health/medicine, output 1–3 short PubMed search queries (Entrez query syntax) to find papers that could support or refute the claims. Use terms like drug names, conditions, and key phrases. Each query should be a single line, no quotes.`,
      prompt: `Model response to analyze:\n\n${responseText.slice(0, 6000)}\n\nOutput 1–3 PubMed search queries (Entrez style) to cross-reference these claims.`,
    });

    const queries: string[] = (result.output.queries ?? []).slice(0, MAX_QUERIES).filter(Boolean);
    if (queries.length === 0) {
      return Response.json({ queries: [], papers: [] });
    }

    const allPmids: string[] = [];
    for (const term of queries) {
      const { idList } = await esearch({ term, retmax: PAPERS_PER_QUERY });
      allPmids.push(...idList);
    }
    const uniquePmids = [...new Set(allPmids)].slice(0, MAX_TOTAL_PAPERS);
    const papers: PubMedArticle[] = uniquePmids.length > 0 ? await efetchAbstracts(uniquePmids) : [];

    return Response.json({ queries, papers });
  } catch (error) {
    console.error("PubMed search error:", error);
    return Response.json(
      { error: error instanceof Error ? error.message : "PubMed search failed" },
      { status: 500 }
    );
  }
}
