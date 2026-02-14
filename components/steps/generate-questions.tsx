"use client"

import { useEffect, useRef } from "react"
import { useWorkflow } from "@/lib/workflow-context"
import { WorkflowStep, FAILURE_MODES, type TestQuestion, type FailureModeId } from "@/lib/types"
import { Card, CardContent } from "@/components/ui/card"
import { Loader2, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"

export function GenerateQuestions() {
  const { state, dispatch } = useWorkflow()
  const hasStarted = useRef(false)

  useEffect(() => {
    if (hasStarted.current) return
    if (!state.modelConfig) return
    if (state.questions.length > 0) {
      dispatch({ type: "SET_STEP", step: WorkflowStep.REVIEW })
      return
    }

    hasStarted.current = true
    generateQuestions()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function generateQuestions() {
    dispatch({ type: "SET_LOADING", loading: true })
    dispatch({ type: "SET_ERROR", error: null })

    try {
      const res = await fetch("/api/generate-questions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          description: state.modelConfig!.description,
          failureModes: FAILURE_MODES,
        }),
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || "Failed to generate questions")
      }

      const { data } = await res.json()

      const questions: TestQuestion[] = data.categories.flatMap(
        (cat: { failureMode: string; questions: string[] }) =>
          cat.questions.map((text: string, i: number) => ({
            id: `${cat.failureMode}-${i}`,
            failureMode: cat.failureMode as FailureModeId,
            text,
            enabled: true,
          }))
      )

      dispatch({ type: "SET_QUESTIONS", questions })
      dispatch({ type: "SET_LOADING", loading: false })
      dispatch({ type: "SET_STEP", step: WorkflowStep.REVIEW })
    } catch (error) {
      dispatch({
        type: "SET_ERROR",
        error: error instanceof Error ? error.message : "Failed to generate questions",
      })
    }
  }

  return (
    <div className="flex flex-col items-center justify-center gap-6 py-12">
      <Card className="w-full max-w-lg">
        <CardContent className="flex flex-col items-center gap-4 py-10">
          {state.isLoading && (
            <>
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[hsl(var(--primary))]/10">
                <Loader2 className="h-7 w-7 animate-spin text-[hsl(var(--primary))]" />
              </div>
              <div className="text-center">
                <h3 className="text-lg font-semibold">Generating Test Questions</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Claude is creating 25 safety-probing questions across 5 failure modes...
                </p>
              </div>
              <div className="flex flex-wrap justify-center gap-2 mt-2">
                {FAILURE_MODES.map((fm) => (
                  <span
                    key={fm.id}
                    className="inline-flex items-center rounded-full bg-secondary px-2.5 py-0.5 text-xs font-medium text-secondary-foreground"
                  >
                    {fm.label}
                  </span>
                ))}
              </div>
            </>
          )}

          {state.error && (
            <>
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10">
                <Sparkles className="h-7 w-7 text-destructive" />
              </div>
              <div className="text-center">
                <h3 className="text-lg font-semibold">Generation Failed</h3>
                <p className="text-sm text-destructive mt-1">{state.error}</p>
              </div>
              <Button
                onClick={() => {
                  hasStarted.current = false
                  generateQuestions()
                }}
                variant="outline"
              >
                Retry
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
