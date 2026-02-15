import { type GoldenAnswer, type ModelResponse, type SimilarityResult, type FailureModeId } from "@/lib/types"

const HF_MODEL_URL =
  "https://api-inference.huggingface.co/pipeline/feature-extraction/NeuML/pubmedbert-base-embeddings"

function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0
  let magA = 0
  let magB = 0
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i]
    magA += a[i] * a[i]
    magB += b[i] * b[i]
  }
  const magnitude = Math.sqrt(magA) * Math.sqrt(magB)
  if (magnitude === 0) return 0
  return dot / magnitude
}

function meanPool(tokenEmbeddings: number[][]): number[] {
  if (tokenEmbeddings.length === 0) return []
  const dim = tokenEmbeddings[0].length
  const pooled = new Array(dim).fill(0)
  for (const token of tokenEmbeddings) {
    for (let i = 0; i < dim; i++) {
      pooled[i] += token[i]
    }
  }
  for (let i = 0; i < dim; i++) {
    pooled[i] /= tokenEmbeddings.length
  }
  return pooled
}

function extractEmbedding(raw: number[] | number[][]): number[] {
  if (raw.length === 0) return []
  if (Array.isArray(raw[0])) {
    return meanPool(raw as number[][])
  }
  return raw as number[]
}

async function getEmbeddings(texts: string[], hfToken: string): Promise<number[][]> {
  const response = await fetch(HF_MODEL_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${hfToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      inputs: texts,
      options: { wait_for_model: true },
    }),
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`HuggingFace API error (${response.status}): ${errorText}`)
  }

  const raw: (number[] | number[][])[] = await response.json()
  return raw.map(extractEmbedding)
}

function getLastAssistantMessage(response: ModelResponse): string {
  const assistantTurns = response.turns.filter((t) => t.role === "assistant")
  return assistantTurns.length > 0
    ? assistantTurns[assistantTurns.length - 1].content
    : ""
}

export async function POST(req: Request) {
  try {
    const { goldenAnswers, responses } = (await req.json()) as {
      goldenAnswers: GoldenAnswer[]
      responses: ModelResponse[]
    }

    const hfToken = process.env.HF_ACCESS_TOKEN
    if (!hfToken) {
      return Response.json(
        { error: "HF_ACCESS_TOKEN environment variable is not set" },
        { status: 500 }
      )
    }

    const results: SimilarityResult[] = []

    for (const golden of goldenAnswers) {
      const modeResponses = responses.filter(
        (r) => r.failureMode === golden.failureMode
      )

      if (modeResponses.length === 0) {
        results.push({
          failureMode: golden.failureMode as FailureModeId,
          averageSimilarity: 0,
          responseScores: [],
        })
        continue
      }

      const responseTexts = modeResponses.map(getLastAssistantMessage).filter(Boolean)

      if (responseTexts.length === 0) {
        results.push({
          failureMode: golden.failureMode as FailureModeId,
          averageSimilarity: 0,
          responseScores: modeResponses.map((r) => ({
            questionId: r.questionId,
            similarity: 0,
          })),
        })
        continue
      }

      const allTexts = [golden.goldenAnswer, ...responseTexts]
      const embeddings = await getEmbeddings(allTexts, hfToken)

      const goldenEmbedding = embeddings[0]
      const responseEmbeddings = embeddings.slice(1)

      const responseScores: { questionId: string; similarity: number }[] = []
      let textIndex = 0

      for (const modeResponse of modeResponses) {
        const lastMsg = getLastAssistantMessage(modeResponse)
        if (!lastMsg) {
          responseScores.push({ questionId: modeResponse.questionId, similarity: 0 })
          continue
        }

        const similarity = cosineSimilarity(goldenEmbedding, responseEmbeddings[textIndex])
        responseScores.push({
          questionId: modeResponse.questionId,
          similarity: Math.max(0, Math.min(1, similarity)),
        })
        textIndex++
      }

      const avgSimilarity =
        responseScores.length > 0
          ? responseScores.reduce((sum, s) => sum + s.similarity, 0) / responseScores.length
          : 0

      results.push({
        failureMode: golden.failureMode as FailureModeId,
        averageSimilarity: avgSimilarity,
        responseScores,
      })
    }

    return Response.json({ data: results })
  } catch (error) {
    console.error("Compute similarity error:", error)
    return Response.json(
      { error: error instanceof Error ? error.message : "Failed to compute similarity" },
      { status: 500 }
    )
  }
}
