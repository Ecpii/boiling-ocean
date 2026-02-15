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

/** Legacy failure mode IDs that have guideline snippets (for PubMedBERT alignment). */
export type FailureModeId =
  | "drug-interactions"
  | "triage-recognition"
  | "diagnostic-boundaries"
  | "patient-privacy"
  | "clinical-guidelines";

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
  /** 1-100 when question had groundTruth and confidence was requested. */
  confidenceScore?: number;
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

/** Per-response citation check: PMID validation + uncited reference flag. */
export interface CitationCheckResult {
  questionId: string;
  citationsTransparentAndNoted: boolean;
  pmids: { pmid: string; valid: boolean }[];
  uncitedReferences: string[];
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
  /** Citation transparency: yes/no per response and summary. */
  citationResults?: {
    allTransparent: boolean;
    perResponse: { questionId: string; citationsTransparentAndNoted: boolean; invalidPmids?: string[]; uncitedReferences?: string[] }[];
  };
  /** Confidence calibration (ECE, 5 bins) when ground-truth questions have confidence scores. */
  calibrationResults?: {
    ece: number;
    numBins: number;
    bins: { binMin: number; binMax: number; avgConfidence: number; accuracy: number; count: number }[];
  };
  /** Demographic disparity: accuracy by dimension (age/gender) and value; all analysis levels for variants. */
  demographicDisparity?: {
    byDimension: Record<
      string,
      { value: string; accuracyPct: number; count: number; correct: number }[]
    >;
    summary: string;
  };
  /** Guideline adherence (5 guidelines, Class I); separate section. */
  guidelineAdherence?: {
    byGuideline: { guideline: string; adherenceScore: number; matched: number; total: number; details: string[] }[];
    summary: string;
  };
  /** UMLS concept accuracy: per response and per failure mode. */
  umlsConceptAccuracy?: {
    perResponse: { questionId: string; validConcepts: number; totalConcepts: number; scorePct: number }[];
    perFailureMode: { failureMode: string; avgScorePct: number; responseCount: number }[];
    summary: string;
  };
  /** Multi-step reasoning: per-conversation analysis, aggregated. */
  multiStepReasoning?: {
    perConversation: { questionId: string; stepScores: number[]; aggregateScore: number }[];
    overallScore: number;
    summary: string;
  };
  /** Real-time / Grammarly-style score (0-100) and breakdown (accuracy + similarity). */
  realTimeScore?: number;
  scoringBreakdown?: { accuracyPct?: number; similarityPct?: number; citationPct?: number; umlsPct?: number; [key: string]: number | undefined };
}

/** UMLS concept validation result (per response and per failure mode). */
export interface UmlsValidationResult {
  perResponse: { questionId: string; failureMode: string; validConcepts: number; totalConcepts: number; scorePct: number }[];
  perFailureMode: { failureMode: string; avgScorePct: number; responseCount: number }[];
  summary: string;
}

/** Multi-step reasoning analysis (per conversation, aggregated). */
export interface MultiStepReasoningResult {
  perConversation: { questionId: string; stepScores: number[]; aggregateScore: number }[];
  overallScore: number;
  summary: string;
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
  citationCheckResults: CitationCheckResult[] | null;
  umlsValidationResults: UmlsValidationResult | null;
  multiStepReasoningResults: MultiStepReasoningResult | null;
  report: AuditReport | null;
}
