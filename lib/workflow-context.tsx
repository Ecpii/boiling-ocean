"use client"

import React, { createContext, useContext, useReducer, useEffect, useCallback } from "react"
import type {
  WorkflowState,
  WorkflowStep,
  ModelConfig,
  TestQuestion,
  ModelResponse,
  HumanReview,
  AuditReport,
} from "./types"

const STORAGE_KEY = "ai-validation-workflow"

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
  | { type: "ADD_HUMAN_REVIEW"; review: HumanReview }
  | { type: "SET_REPORT"; report: AuditReport }
  | { type: "SET_LOADING"; loading: boolean }
  | { type: "SET_ERROR"; error: string | null }
  | { type: "RESET" }
  | { type: "HYDRATE"; state: WorkflowState }

const initialState: WorkflowState = {
  step: 0,
  modelConfig: null,
  questions: [],
  responses: [],
  humanReviews: [],
  report: null,
  isLoading: false,
  error: null,
}

function reducer(state: WorkflowState, action: Action): WorkflowState {
  switch (action.type) {
    case "SET_STEP":
      return { ...state, step: action.step, error: null }
    case "SET_MODEL_CONFIG":
      return { ...state, modelConfig: action.config }
    case "SET_QUESTIONS":
      return { ...state, questions: action.questions }
    case "UPDATE_QUESTION":
      return {
        ...state,
        questions: state.questions.map((q) => (q.id === action.id ? { ...q, text: action.text } : q)),
      }
    case "TOGGLE_QUESTION":
      return {
        ...state,
        questions: state.questions.map((q) => (q.id === action.id ? { ...q, enabled: !q.enabled } : q)),
      }
    case "ADD_QUESTION":
      return { ...state, questions: [...state.questions, action.question] }
    case "REMOVE_QUESTION":
      return { ...state, questions: state.questions.filter((q) => q.id !== action.id) }
    case "SET_RESPONSES":
      return { ...state, responses: action.responses }
    case "ADD_RESPONSE":
      return { ...state, responses: [...state.responses, action.response] }
    case "ADD_HUMAN_REVIEW":
      return {
        ...state,
        humanReviews: [
          ...state.humanReviews.filter((r) => r.responseId !== action.review.responseId),
          action.review,
        ],
      }
    case "SET_REPORT":
      return { ...state, report: action.report }
    case "SET_LOADING":
      return { ...state, isLoading: action.loading }
    case "SET_ERROR":
      return { ...state, error: action.error, isLoading: false }
    case "RESET":
      return { ...initialState }
    case "HYDRATE":
      return { ...action.state, isLoading: false, error: null }
    default:
      return state
  }
}

interface WorkflowContextType {
  state: WorkflowState
  dispatch: React.Dispatch<Action>
  resetWorkflow: () => void
}

const WorkflowContext = createContext<WorkflowContextType | null>(null)

export function WorkflowProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState)
  const [hydrated, setHydrated] = React.useState(false)

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) {
        const parsed = JSON.parse(saved) as WorkflowState
        dispatch({ type: "HYDRATE", state: parsed })
      }
    } catch {
      // ignore parse errors
    }
    setHydrated(true)
  }, [])

  useEffect(() => {
    if (hydrated) {
      const { isLoading, error, ...rest } = state
      localStorage.setItem(STORAGE_KEY, JSON.stringify(rest))
    }
  }, [state, hydrated])

  const resetWorkflow = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY)
    dispatch({ type: "RESET" })
  }, [])

  if (!hydrated) {
    return null
  }

  return (
    <WorkflowContext.Provider value={{ state, dispatch, resetWorkflow }}>
      {children}
    </WorkflowContext.Provider>
  )
}

export function useWorkflow() {
  const context = useContext(WorkflowContext)
  if (!context) {
    throw new Error("useWorkflow must be used within a WorkflowProvider")
  }
  return context
}
