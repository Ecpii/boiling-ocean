"use client";

import React, {
  createContext,
  useContext,
  useReducer,
  useEffect,
  useCallback,
} from "react";
import {
  WorkflowState,
  WorkflowStep,
  ModelConfig,
  TestQuestion,
  ModelResponse,
  GoldenAnswer,
  SimilarityResult,
  AuditReport,
} from "./types";
import {
  DEFAULT_DESCRIPTION,
  DEFAULT_QUESTIONS,
  DEFAULT_REPORT,
  DEFAULT_RESPONSES,
} from "./consts";

const STORAGE_KEY = "ai-validation-workflow";

type Action =
  | { type: "SET_STEP"; step: WorkflowStep }
  | { type: "SET_MODEL_CONFIG"; config: ModelConfig }
  | { type: "SET_QUESTIONS"; questions: TestQuestion[] }
  | { type: "UPDATE_QUESTION"; id: string; text: string }
  | { type: "TOGGLE_QUESTION"; id: string }
  | { type: "ADD_QUESTION"; question: TestQuestion }
  | { type: "REMOVE_QUESTION"; id: string }
  | { type: "SET_RESPONSES"; responses: ModelResponse[] }
  | { type: "ADD_RESPONSE"; response: ModelResponse }
  | { type: "ADD_GOLDEN_ANSWER"; goldenAnswer: GoldenAnswer }
  | { type: "SET_SIMILARITY_RESULTS"; results: SimilarityResult[] }
  | { type: "SET_REPORT"; report: AuditReport }
  | { type: "SET_LOADING"; loading: boolean }
  | { type: "SET_ERROR"; error: string | null }
  | { type: "RESET" }
  | { type: "HYDRATE"; state: WorkflowState }
  | { type: "DEBUG_SKIP_TO"; step: WorkflowStep };

const initialState: WorkflowState = {
  step: 0,
  modelConfig: null,
  questions: [],
  responses: [],
  goldenAnswers: [],
  similarityResults: [],
  report: null,
};

const DEBUG_DEFAULT_STEP_STATES: Record<WorkflowStep, WorkflowState> = {
  [WorkflowStep.CONFIGURE]: initialState,
  [WorkflowStep.GENERATE]: {
    ...initialState,
    step: 1,
    modelConfig: {
      provider: "openai",
      apiKey: "",
      modelId: "gpt-4o",
      description: DEFAULT_DESCRIPTION,
    },
  },
  [WorkflowStep.REVIEW]: {
    ...initialState,
    step: 2,
    modelConfig: {
      provider: "openai",
      apiKey: "",
      modelId: "gpt-4o",
      description: DEFAULT_DESCRIPTION,
    },
    questions: DEFAULT_QUESTIONS,
  },
  [WorkflowStep.COLLECT]: {
    ...initialState,
    step: 3,
    modelConfig: {
      provider: "openai",
      apiKey: "",
      modelId: "gpt-4o",
      description: DEFAULT_DESCRIPTION,
    },
    questions: DEFAULT_QUESTIONS,
  },
  [WorkflowStep.HUMAN_REVIEW]: {
    step: 4,
    modelConfig: {
      provider: "openai",
      apiKey: "",
      modelId: "gpt-4o",
      description: DEFAULT_DESCRIPTION,
    },
    questions: DEFAULT_QUESTIONS,
    responses: DEFAULT_RESPONSES,
    goldenAnswers: [],
    similarityResults: [],
    report: null,
  },
  [WorkflowStep.REPORT]: {
    step: 5,
    modelConfig: {
      provider: "openai",
      apiKey: "",
      modelId: "gpt-4o",
      description: DEFAULT_DESCRIPTION,
    },
    questions: DEFAULT_QUESTIONS,
    responses: DEFAULT_RESPONSES,
    goldenAnswers: [],
    similarityResults: [],
    report: DEFAULT_REPORT,
  },
};

function reducer(state: WorkflowState, action: Action): WorkflowState {
  switch (action.type) {
    case "SET_STEP":
      return { ...state, step: action.step };
    case "SET_MODEL_CONFIG":
      return { ...state, modelConfig: action.config };
    case "SET_QUESTIONS":
      return { ...state, questions: action.questions };
    case "UPDATE_QUESTION":
      return {
        ...state,
        questions: state.questions.map((q) =>
          q.id === action.id ? { ...q, text: action.text } : q,
        ),
      };
    case "TOGGLE_QUESTION":
      return {
        ...state,
        questions: state.questions.map((q) =>
          q.id === action.id ? { ...q, enabled: !q.enabled } : q,
        ),
      };
    case "ADD_QUESTION":
      return { ...state, questions: [...state.questions, action.question] };
    case "REMOVE_QUESTION":
      return {
        ...state,
        questions: state.questions.filter((q) => q.id !== action.id),
      };
    case "SET_RESPONSES":
      return { ...state, responses: action.responses };
    case "ADD_RESPONSE":
      return { ...state, responses: [...state.responses, action.response] };
    case "ADD_GOLDEN_ANSWER":
      return {
        ...state,
        goldenAnswers: [
          ...state.goldenAnswers.filter(
            (g) => g.failureMode !== action.goldenAnswer.failureMode,
          ),
          action.goldenAnswer,
        ],
      };
    case "SET_SIMILARITY_RESULTS":
      return {
        ...state,
        similarityResults: action.results,
      };
    case "SET_REPORT":
      return { ...state, report: action.report };
    case "RESET":
      return { ...initialState };
    case "HYDRATE":
      return { ...action.state };
    case "DEBUG_SKIP_TO":
      return { ...DEBUG_DEFAULT_STEP_STATES[action.step] };
    default:
      return state;
  }
}

interface WorkflowContextType {
  state: WorkflowState;
  dispatch: React.Dispatch<Action>;
  resetWorkflow: () => void;
}

const WorkflowContext = createContext<WorkflowContextType | null>(null);

export function WorkflowProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const [hydrated, setHydrated] = React.useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as WorkflowState;
        dispatch({ type: "HYDRATE", state: parsed });
      }
    } catch {
      // ignore parse errors
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (hydrated) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    }
  }, [state, hydrated]);

  const resetWorkflow = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    dispatch({ type: "RESET" });
  }, []);

  if (!hydrated) {
    return null;
  }

  return (
    <WorkflowContext.Provider value={{ state, dispatch, resetWorkflow }}>
      {children}
    </WorkflowContext.Provider>
  );
}

export function useWorkflow() {
  const context = useContext(WorkflowContext);
  if (!context) {
    throw new Error("useWorkflow must be used within a WorkflowProvider");
  }
  return context;
}
