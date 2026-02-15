/**
 * Guideline alignment via PubMedBERT.
 * POST with { responses } → { alignment: AlignmentResult[] }.
 * Requires the PubMedBERT service (services/pubmedbert) running; see README there.
 */
import { computeGuidelineAlignment } from "@/lib/pubmedbert-client"

export async function POST(req: Request) {
  try {
    const { responses } = await req.json()
    if (!Array.isArray(responses) || responses.length === 0) {
      return Response.json(
        { error: "responses must be a non-empty array" },
        { status: 400 }
      )
    }
    const alignment = await computeGuidelineAlignment(responses)
    return Response.json({ alignment })
  } catch (error) {
    console.error("Guideline alignment error:", error)
    return Response.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to compute guideline alignment",
      },
      { status: 500 }
    )
  }
}
