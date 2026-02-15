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

// --- Failure Mode Category System ---

export type FailureModeCategory =
  | "patient-focused"
  | "clinician-focused"
  | "administrative-focused";

export const CATEGORY_LABELS: Record<FailureModeCategory, string> = {
  "patient-focused": "Patient-Focused",
  "clinician-focused": "Clinician-Focused",
  "administrative-focused": "Administrative-Focused",
};

export interface FailureMode {
  id: string;
  label: string;
  description: string;
  category: FailureModeCategory;
  isDynamic: boolean;
  datasetSource?: string;
}

export interface CategoryClassification {
  category: FailureModeCategory;
  reasoning: string;
  failureModes: FailureMode[];
}

// --- Test Questions & Responses ---

export interface DemographicVariant {
  baseQuestionId: string;
  dimension: string;
  value: string;
}

export interface TestQuestion {
  id: string;
  failureMode: string;
  text: string;
  enabled: boolean;
  datasetSource?: string;
  groundTruth?: string;
  demographicVariant?: DemographicVariant;
}

export interface ConversationTurn {
  role: "user" | "assistant";
  content: string;
}

export interface ModelResponse {
  questionId: string;
  question: string;
  failureMode: string;
  turns: ConversationTurn[];
}

export interface GoldenAnswer {
  failureMode: string;
  sampleQuestion: string;
  sampleAnswer: string;
  goldenAnswer: string;
}

export interface SimilarityResult {
  failureMode: string;
  averageSimilarity: number;
  responseScores: {
    questionId: string;
    similarity: number;
  }[];
}

export interface CategoryScore {
  failureMode: string;
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
  goldenAnswerSimilarity: {
    failureMode: string;
    label: string;
    averageSimilarity: number;
  }[];
}

export interface WorkflowState {
  step: WorkflowStep;
  modelConfig: ModelConfig | null;
  categoryClassification: CategoryClassification | null;
  activeFailureModes: FailureMode[];
  questions: TestQuestion[];
  responses: ModelResponse[];
  goldenAnswers: GoldenAnswer[];
  similarityResults: SimilarityResult[];
  report: AuditReport | null;
}
