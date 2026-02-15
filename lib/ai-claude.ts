/**
 * Claude model for auditor tasks (generate-questions, generate-sample, generate-followup, etc.).
 * When ANTHROPIC_API_KEY is set in .env.local, uses your Anthropic key directly (4K req/min etc.).
 * Otherwise uses Vercel AI Gateway (subject to free-tier rate limits).
 */
import { createAnthropic } from "@ai-sdk/anthropic"
import type { LanguageModel } from "ai"

const CLAUDE_MODEL_ID = "claude-sonnet-4-20250514"

export function getClaudeModel(): LanguageModel {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (apiKey?.trim()) {
    return createAnthropic({ apiKey: apiKey.trim() })(CLAUDE_MODEL_ID) as LanguageModel
  }
  return `anthropic/${CLAUDE_MODEL_ID}`
}
