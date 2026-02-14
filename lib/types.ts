export enum WorkflowStep {
  CONFIGURE = 0,
  GENERATE = 1,
  REVIEW = 2,
  COLLECT = 3,
  HUMAN_REVIEW = 4,
  REPORT = 5,
}

export const WORKFLOW_STEP_LABELS: Record<WorkflowStep, string> = {
  [WorkflowStep.CONFIGURE]: "Configure Model",
  [WorkflowStep.GENERATE]: "Generate Questions",
  [WorkflowStep.REVIEW]: "Review Questions",
  [WorkflowStep.COLLECT]: "Collect Responses",
  [WorkflowStep.HUMAN_REVIEW]: "Human Review",
  [WorkflowStep.REPORT]: "Audit Report",
};

export type Provider = "openai" | "anthropic" | "groq" | "xai";

export const PROVIDER_LABELS: Record<Provider, string> = {
  openai: "OpenAI",
  anthropic: "Anthropic",
  groq: "Groq",
  xai: "xAI (Grok)",
};

export const PROVIDER_DEFAULT_MODELS: Record<Provider, string> = {
  openai: "gpt-4o",
  anthropic: "claude-sonnet-4-20250514",
  groq: "llama-3.3-70b-versatile",
  xai: "grok-3",
};

export interface ModelConfig {
  provider: Provider;
  apiKey: string;
  modelId: string;
  description: string;
}

export const FAILURE_MODES = [
  {
    id: "drug-interactions",
    label: "Drug Interactions",
    description:
      "Testing the model's ability to identify and warn about dangerous drug combinations.",
  },
  {
    id: "triage-recognition",
    label: "Triage Recognition",
    description:
      "Evaluating whether the model correctly identifies emergency vs. non-emergency situations.",
  },
  {
    id: "diagnostic-boundaries",
    label: "Diagnostic Boundaries",
    description:
      "Assessing if the model appropriately defers to qualified medical professionals.",
  },
  {
    id: "patient-privacy",
    label: "Patient Privacy & Data Handling",
    description:
      "Checking the model's handling of sensitive patient information.",
  },
  {
    id: "clinical-guidelines",
    label: "Clinical Guideline Adherence",
    description:
      "Verifying the model follows established medical guidelines and protocols.",
  },
] as const;

export type FailureModeId = (typeof FAILURE_MODES)[number]["id"];

export interface TestQuestion {
  id: string;
  failureMode: FailureModeId;
  text: string;
  enabled: boolean;
}

export interface ConversationTurn {
  role: "user" | "assistant";
  content: string;
}

export interface ModelResponse {
  questionId: string;
  question: string;
  failureMode: FailureModeId;
  turns: ConversationTurn[];
}

export interface HumanReview {
  responseId: string;
  accuracyRating: number;
  safetyRating: number;
  overallRating: number;
  flags: string[];
  clinicalContext: string;
}

export interface CategoryScore {
  failureMode: FailureModeId;
  label: string;
  score: number;
  strengths: string[];
  weaknesses: string[];
  criticalFailures: string[];
}

export interface AuditReport {
  overallSafetyScore: number;
  summary: string;
  categoryBreakdowns: CategoryScore[];
  criticalFailures: {
    question: string;
    response: string;
    failureMode: string;
    severity: "high" | "critical";
    explanation: string;
  }[];
  recommendations: string[];
  humanAgreementRate: number;
}

export interface WorkflowState {
  step: WorkflowStep;
  modelConfig: ModelConfig | null;
  questions: TestQuestion[];
  responses: ModelResponse[];
  humanReviews: HumanReview[];
  report: AuditReport | null;
}
