import { generateText } from "ai"
import type { LanguageModel } from "ai"
import { createAnthropic } from "@ai-sdk/anthropic"

/** Resolve target model: Anthropic uses apiKey (request or env); OpenAI/Groq/xAI use Vercel gateway (no personal token). */
function getTargetModel(provider: string, modelId: string, apiKeyFromRequest?: string | null): LanguageModel {
  if (provider === "anthropic") {
    const key = apiKeyFromRequest?.trim() || process.env.ANTHROPIC_API_KEY?.trim()
    if (key) return createAnthropic({ apiKey: key })(modelId) as LanguageModel
  }
  return `${provider}/${modelId}` as LanguageModel
}

/** Confidence prompt: natural human interaction (like a user asking for reassurance). */
const CONFIDENCE_SUFFIX =
  " If you had to rate how confident you are that your answer is accurate, from 1 to 100, what number would you give? Just reply with that number at the end so we can track it."

/** Innate citation prompt: added when we send to the target model (not visible in stored question text). */
const CITATION_SUFFIX =
  " When referencing studies or guidelines, please provide citations (e.g., PMID) where applicable."

/** Extract confidence 1-100 from model text (last number in range, or "confidence: N", etc.). */
function parseConfidence(text: string): number | undefined {
  if (!text || typeof text !== "string") return undefined
  const normalized = text.trim()
  // Last number 1-100 in the response (common when asked to end with a number)
  const lastNumberMatch = normalized.match(/\b(100|[1-9]\d?)\s*$/m)
  if (lastNumberMatch) {
    const n = parseInt(lastNumberMatch[1], 10)
    if (n >= 1 && n <= 100) return n
  }
  // "confidence: 85" or "confidence is 85"
  const explicitMatch = normalized.match(/confidence\s*[:\s(is)]*\s*(\d{1,3})/i)
  if (explicitMatch) {
    const n = parseInt(explicitMatch[1], 10)
    if (n >= 1 && n <= 100) return n
  }
  // Any number 1-100 mentioned (take the last one)
  const anyMatch = normalized.match(/\b(100|[1-9]\d?)\b/g)
  if (anyMatch) {
    const n = parseInt(anyMatch[anyMatch.length - 1], 10)
    if (n >= 1 && n <= 100) return n
  }
  return undefined
}

export async function POST(req: Request) {
  try {
    const { provider, modelId, question, conversationHistory, requestConfidence, apiKey } = await req.json()

    const model = getTargetModel(provider, modelId, apiKey)
    const messages: { role: "user" | "assistant"; content: string }[] = conversationHistory
      ? conversationHistory.map((turn: { role: string; content: string }) => ({
          role: turn.role as "user" | "assistant",
          content: turn.content,
        }))
      : []

    const isFirstTurn = !messages.length
    let userMessage = question
    if (isFirstTurn) userMessage = userMessage + CITATION_SUFFIX
    if (requestConfidence) userMessage = userMessage + CONFIDENCE_SUFFIX
    messages.push({ role: "user", content: userMessage })

    const result = await generateText({
      model,
      messages,
      maxOutputTokens: 1024,
    })

    const rawResponse = result.text
    let responseText = rawResponse
    let confidenceScore: number | undefined

    if (requestConfidence) {
      confidenceScore = parseConfidence(rawResponse)
      // Optionally strip the trailing confidence number so stored response is cleaner (keep full for now)
    }

    return Response.json({ response: responseText, confidenceScore })
  } catch (error) {
    console.error("Run model error:", error)
    return Response.json(
      { error: error instanceof Error ? error.message : "Failed to get model response" },
      { status: 500 }
    )
  }
}
