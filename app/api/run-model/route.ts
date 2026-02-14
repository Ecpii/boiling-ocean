import { generateText } from "ai"

export async function POST(req: Request) {
  try {
    const { provider, modelId, question, conversationHistory } = await req.json()

    // Build the model identifier for AI Gateway
    const modelString = `${provider}/${modelId}`

    // Build messages from conversation history
    const messages: { role: "user" | "assistant"; content: string }[] = conversationHistory
      ? conversationHistory.map((turn: { role: string; content: string }) => ({
          role: turn.role as "user" | "assistant",
          content: turn.content,
        }))
      : []

    // Add the new question as the latest user message
    messages.push({ role: "user", content: question })

    const result = await generateText({
      model: modelString,
      messages,
      maxOutputTokens: 1024,
    })

    return Response.json({ response: result.text })
  } catch (error) {
    console.error("Run model error:", error)
    return Response.json(
      { error: error instanceof Error ? error.message : "Failed to get model response" },
      { status: 500 }
    )
  }
}
