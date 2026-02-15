# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a healthcare AI safety validator application built with Next.js 16. It provides a workflow-based interface for auditing AI models against healthcare safety criteria. The application tests models across 5 failure modes (drug interactions, triage recognition, diagnostic boundaries, patient privacy, and clinical guidelines) by generating test questions, collecting model responses, enabling human review, and producing a comprehensive audit report.

## Development Commands

- `pnpm install` - Install dependencies (uses pnpm, not npm)
- `pnpm dev` - Start development server with Turbopack
- `pnpm build` - Build for production
- `pnpm start` - Run production build
- `pnpm lint` - Run Next.js linter

Note: This project uses pnpm as the package manager. Always use `pnpm` commands, not `npm` or `yarn`.

## Architecture

### Workflow System

The application implements a 6-step linear workflow managed through React Context:

1. **CONFIGURE** (step 0): Configure the AI model to test (provider, API key, model ID, description)
2. **GENERATE** (step 1): Generate test questions using Claude Sonnet 4 across all failure modes
3. **REVIEW** (step 2): Review, edit, enable/disable generated questions
4. **COLLECT** (step 3): Run the configured model against enabled questions, supporting multi-turn conversations
5. **HUMAN_REVIEW** (step 4): Human reviewers rate responses on accuracy, safety, and overall quality
6. **REPORT** (step 5): Generate final audit report using Claude Sonnet 4 to analyze all responses

### State Management

All workflow state is managed via `lib/workflow-context.tsx`:
- Uses React Context + useReducer pattern
- Automatically persists to localStorage under key `"ai-validation-workflow"`
- Hydrates on mount to restore previous sessions
- Access via `useWorkflow()` hook which provides `{ state, dispatch, resetWorkflow }`

Key state shape (see `lib/types.ts`):
```typescript
{
  step: WorkflowStep           // Current workflow step (0-5)
  modelConfig: ModelConfig     // Provider/API key/model being tested
  questions: TestQuestion[]    // Generated test questions
  responses: ModelResponse[]   // Model responses with conversation turns
  humanReviews: HumanReview[]  // Human ratings
  report: AuditReport          // Final safety audit report
}
```

### API Routes

All API routes are in `app/api/` and use the Vercel AI SDK:

- **POST /api/generate-questions**: Uses Claude Sonnet 4 with structured output to generate 5 questions per failure mode. Takes `description` and `failureModes` array.

- **POST /api/run-model**: Runs the model being tested. Takes `provider`, `modelId`, optional `apiKey`, `question`, and `conversationHistory`. Anthropic uses apiKey (from Configure or ANTHROPIC_API_KEY env); OpenAI/Groq/xAI use Vercel AI Gateway (no personal token).

- **POST /api/evaluate-responses**: Uses Claude Sonnet 4 with structured output to generate final audit report. Takes `responses`, `humanReviews`, and `description`.

- **POST /api/generate-followup**: (Used for multi-turn conversations in COLLECT step)

### Multi-Provider Support

The app supports testing models from 4 providers (see `lib/types.ts`):
- `openai` - Default: gpt-4o
- `anthropic` - Default: claude-sonnet-4-20250514
- `groq` - Default: llama-3.3-70b-versatile
- `xai` - Default: grok-3

The AI SDK model string format is `"provider/modelId"` (e.g., `"anthropic/claude-sonnet-4-20250514"`).

### Component Structure

- `app/page.tsx` - Main entry point, renders workflow stepper + current step component
- `app/layout.tsx` - Root layout with fonts (Geist, Geist Mono) and metadata
- `components/workflow-stepper.tsx` - Progress indicator showing all 6 steps
- `components/steps/*.tsx` - One component per workflow step
- `components/ui/*.tsx` - shadcn/ui components (Radix UI + Tailwind)
- `lib/types.ts` - All TypeScript types and constants
- `lib/workflow-context.tsx` - Global state management
- `lib/utils.ts` - Utility functions (likely just `cn()` for classnames)

### Failure Modes

The application tests 5 healthcare-specific failure modes (defined in `lib/types.ts`):

1. `drug-interactions` - Identifying dangerous drug combinations
2. `triage-recognition` - Emergency vs. non-emergency identification
3. `diagnostic-boundaries` - Appropriately deferring to medical professionals
4. `patient-privacy` - Handling sensitive patient information
5. `clinical-guidelines` - Following established medical protocols

Each test question is tagged with one failure mode, and the final report includes per-category breakdowns.

## Technology Stack

- **Framework**: Next.js 16.1.6 with App Router and Turbopack
- **React**: 19.2.3 (note: uses latest React 19)
- **TypeScript**: 5.7.3 with strict mode enabled
- **Styling**: Tailwind CSS 3/4 hybrid setup (using both versions)
- **UI Components**: shadcn/ui (Radix UI primitives)
- **AI Integration**: Vercel AI SDK (`ai` package) with structured outputs (zod schemas)
- **Forms**: React Hook Form + Zod validation
- **Charts**: Recharts for data visualization in reports
- **Icons**: lucide-react

### Path Alias

The project uses `@/*` to reference root-level imports (configured in `tsconfig.json`):
```typescript
import { useWorkflow } from "@/lib/workflow-context"
import { Button } from "@/components/ui/button"
```

## Environment (rate limits)

- **ANTHROPIC_API_KEY** (optional): When set in `.env.local`, all auditor Claude calls (generate-questions, generate-sample, generate-followup, evaluate-responses, etc.) use your Anthropic key directly instead of the Vercel AI Gateway. This gives you your account’s rate limits (e.g. 4K requests/min for Claude Sonnet) and avoids Vercel free-tier 429s. Get a key at https://console.anthropic.com/

OpenAI, Groq, and xAI (target models) all go through the Vercel AI Gateway; no personal API keys are used for run-model for those providers.

## Important Notes

- All AI generation (questions and report) uses Claude Sonnet 4, but the model being *tested* can be from any supported provider
- API keys are stored in client-side state and localStorage (no server-side env vars for the tested model)
- The workflow is strictly linear - users cannot skip steps
- Responses support multi-turn conversations, not just single Q&A
- Human review is optional but improves the final audit report
- The app has no authentication or backend database - everything is client-side
