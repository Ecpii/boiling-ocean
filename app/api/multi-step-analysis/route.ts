/**
 * Multi-step reasoning analysis: after collect, analyze each conversation
 * separately. Each conversation is separate in prompt and analyzed separately.
 * Scores aggregated in a statistically sound way (mean per conversation, then mean across).
 * POST { responses: { questionId, turns }[] }
 */

import { generateText, Output } from "ai";
import { getClaudeModel } from "@/lib/ai-claude";
import { z } from "zod";

const stepSchema = z.object({
  stepScores: z.array(z.number().min(0).max(100)).describe("One score 0-100 per assistant turn: usefulness and correctness of that step"),
});

export async function POST(req: Request) {
  try {
    const { responses } = (await req.json()) as {
      responses: { questionId: string; turns: { role: string; content: string }[] }[];
    };
    if (!Array.isArray(responses) || responses.length === 0) {
      return Response.json({ error: "responses array required" }, { status: 400 });
    }

    const perConversation: { questionId: string; stepScores: number[]; aggregateScore: number }[] = [];

    for (const r of responses) {
      const assistantTurns = (r.turns ?? []).filter((t) => t.role === "assistant");
      if (assistantTurns.length === 0) {
        perConversation.push({ questionId: r.questionId, stepScores: [], aggregateScore: 0 });
        continue;
      }

      const result = await generateText({
        model: getClaudeModel(),
        output: Output.object({ schema: stepSchema }),
        system: "You evaluate multi-turn medical conversations. For each assistant turn (step), score 0-100: how useful and correct is the information in that step? Consider whether the step adds non-redundant, accurate information. Output stepScores: one number per assistant turn, in order.",
        prompt: `Conversation (analyze each ASSISTANT turn separately; output one score per assistant turn, in order):\n\n${(r.turns ?? [])
          .map((t) => `${t.role.toUpperCase()}: ${t.content.slice(0, 600)}`)
          .join("\n\n")}\n\nOutput stepScores: array of ${assistantTurns.length} numbers (0-100), one per assistant turn.`,
      });

      const stepScores = (result.output.stepScores ?? []).slice(0, assistantTurns.length);
      const aggregateScore =
        stepScores.length > 0
          ? stepScores.reduce((a, b) => a + b, 0) / stepScores.length
          : 0;

      perConversation.push({
        questionId: r.questionId,
        stepScores,
        aggregateScore: Math.round(aggregateScore * 10) / 10,
      });
    }

    const overallScore =
      perConversation.length > 0
        ? perConversation.reduce((a, c) => a + c.aggregateScore, 0) / perConversation.length
        : 0;

    return Response.json({
      data: {
        perConversation,
        overallScore: Math.round(overallScore * 10) / 10,
        summary: `Multi-step reasoning: ${perConversation.length} conversations analyzed separately; scores aggregated as mean per conversation, then mean across conversations.`,
      },
    });
  } catch (error) {
    console.error("Multi-step analysis error:", error);
    return Response.json(
      { error: error instanceof Error ? error.message : "Multi-step analysis failed" },
      { status: 500 }
    );
  }
}
