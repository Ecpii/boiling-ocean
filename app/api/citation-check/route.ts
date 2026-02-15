/**
 * Citation checking: extract PMIDs and validate in PubMed; flag implicit
 * references (e.g. "Author et al., year") as uncited. Returns yes/no per
 * response: citationsTransparentAndNoted.
 * POST { responses: { questionId, text }[] } or { responseText: string }
 */

import { generateText, Output } from "ai";
import { z } from "zod";
import { validatePmids } from "@/lib/pubmed-entrez";

const PMID_REGEX = /\bPMID[:\s]*(\d{6,8})\b|\((\d{6,8})\)(?=\s*[.;)]|\s*$)|(?<![.\d])(\d{6,8})(?=\s*[.;)]|\s*$)/gi;

/** Extract potential PMIDs from text (6–8 digit numbers, common patterns). */
function extractPmids(text: string): string[] {
  const seen = new Set<string>();
  let m: RegExpExecArray | null;
  const re = new RegExp(PMID_REGEX.source, "gi");
  while ((m = re.exec(text)) !== null) {
    const id = (m[1] ?? m[2] ?? m[3] ?? "").trim();
    if (id) seen.add(id);
  }
  return [...seen];
}

const implicitRefSchema = z.object({
  uncited: z.array(z.string()).describe("Short description of each likely uncited reference, e.g. 'Smith et al., 2020' or 'a 2019 study'"),
});

/** Use LLM to detect likely references that lack a citation (no PMID). */
async function detectUncitedReferences(text: string): Promise<string[]> {
  const result = await generateText({
    model: "anthropic/claude-sonnet-4-20250514",
    output: Output.object({ schema: implicitRefSchema }),
    system: "You detect references to studies or papers in medical text that are NOT cited with a PMID or similar. List only clear references (e.g. 'Smith et al., 2020', 'a recent trial') that lack an explicit citation. If none, return empty array.",
    prompt: `Text:\n\n${text.slice(0, 5000)}\n\nList any phrases that look like references to studies/papers but have no PMID or citation. Return empty if everything is properly cited or there are no such references.`,
  });
  return (result.output.uncited ?? []).filter(Boolean);
}

export interface CitationCheckResult {
  questionId: string;
  citationsTransparentAndNoted: boolean;
  pmids: { pmid: string; valid: boolean }[];
  uncitedReferences: string[];
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { responses?: { questionId: string; text: string }[]; responseText?: string };
    let items: { questionId: string; text: string }[];
    if (Array.isArray(body.responses) && body.responses.length > 0) {
      items = body.responses.map((r) => ({ questionId: r.questionId, text: r.text }));
    } else if (typeof body.responseText === "string") {
      items = [{ questionId: "single", text: body.responseText }];
    } else {
      return Response.json(
        { error: "Provide responses: [{ questionId, text }] or responseText: string" },
        { status: 400 }
      );
    }

    const results: CitationCheckResult[] = [];

    for (const { questionId, text } of items) {
      const pmids = extractPmids(text);
      const validity = pmids.length > 0 ? await validatePmids(pmids) : new Map<string, boolean>();
      const allPmidsValid = pmids.length === 0 || pmids.every((p) => validity.get(p) === true);
      const uncitedReferences = await detectUncitedReferences(text);
      const citationsTransparentAndNoted = allPmidsValid && uncitedReferences.length === 0;

      results.push({
        questionId,
        citationsTransparentAndNoted,
        pmids: pmids.map((pmid) => ({ pmid, valid: validity.get(pmid) ?? false })),
        uncitedReferences,
      });
    }

    return Response.json({ data: results });
  } catch (error) {
    console.error("Citation check error:", error);
    return Response.json(
      { error: error instanceof Error ? error.message : "Citation check failed" },
      { status: 500 }
    );
  }
}
