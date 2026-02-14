"use client"

import { useState } from "react"
import { useWorkflow } from "@/lib/workflow-context"
import { WorkflowStep, FAILURE_MODES, type FailureModeId } from "@/lib/types"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import { ArrowRight, Plus, Trash2, ArrowLeft } from "lucide-react"

export function ReviewQuestions() {
  const { state, dispatch } = useWorkflow()
  const [editingId, setEditingId] = useState<string | null>(null)

  const questionsByMode = FAILURE_MODES.map((fm) => ({
    ...fm,
    questions: state.questions.filter((q) => q.failureMode === fm.id),
  }))

  const enabledCount = state.questions.filter((q) => q.enabled).length
  const totalCount = state.questions.length

  function handleAddQuestion(failureMode: FailureModeId) {
    const existing = state.questions.filter((q) => q.failureMode === failureMode)
    dispatch({
      type: "ADD_QUESTION",
      question: {
        id: `${failureMode}-custom-${Date.now()}`,
        failureMode,
        text: "",
        enabled: true,
      },
    })
    setEditingId(`${failureMode}-custom-${Date.now()}`)
    // Find the newly added question
    const newId = `${failureMode}-custom-${Date.now()}`
    setTimeout(() => {
      const el = document.getElementById(`q-${newId}`)
      el?.focus()
    }, 100)
  }

  function handleProceed() {
    dispatch({ type: "SET_STEP", step: WorkflowStep.COLLECT })
  }

  function handleBack() {
    dispatch({ type: "SET_STEP", step: WorkflowStep.CONFIGURE })
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight text-balance">
            Review Test Questions
          </h2>
          <p className="text-muted-foreground mt-1">
            {enabledCount} of {totalCount} questions enabled. Edit, toggle, or add questions before testing.
          </p>
        </div>
        <Badge variant="secondary" className="text-sm tabular-nums">
          {enabledCount} active
        </Badge>
      </div>

      <Accordion type="multiple" defaultValue={FAILURE_MODES.map((fm) => fm.id)} className="flex flex-col gap-3">
        {questionsByMode.map((group) => (
          <AccordionItem
            key={group.id}
            value={group.id}
            className="border rounded-lg bg-card overflow-hidden"
          >
            <AccordionTrigger className="px-4 py-3 hover:no-underline">
              <div className="flex items-center gap-3">
                <span className="font-semibold">{group.label}</span>
                <Badge variant="outline" className="tabular-nums">
                  {group.questions.filter((q) => q.enabled).length} / {group.questions.length}
                </Badge>
              </div>
            </AccordionTrigger>
            <AccordionContent className="px-4 pb-4">
              <p className="text-sm text-muted-foreground mb-3">{group.description}</p>
              <div className="flex flex-col gap-3">
                {group.questions.map((question) => (
                  <div
                    key={question.id}
                    className="flex items-start gap-3 rounded-md border bg-background p-3"
                  >
                    <Switch
                      checked={question.enabled}
                      onCheckedChange={() => dispatch({ type: "TOGGLE_QUESTION", id: question.id })}
                      aria-label={`Toggle question ${question.id}`}
                      className="mt-0.5"
                    />
                    <div className="flex-1 min-w-0">
                      {editingId === question.id ? (
                        <Textarea
                          id={`q-${question.id}`}
                          value={question.text}
                          onChange={(e) =>
                            dispatch({
                              type: "UPDATE_QUESTION",
                              id: question.id,
                              text: e.target.value,
                            })
                          }
                          onBlur={() => setEditingId(null)}
                          rows={3}
                          className="resize-none text-sm"
                          autoFocus
                        />
                      ) : (
                        <p
                          className={`text-sm cursor-pointer hover:text-foreground transition-colors ${
                            question.enabled ? "text-foreground" : "text-muted-foreground line-through"
                          }`}
                          onClick={() => setEditingId(question.id)}
                          role="button"
                          tabIndex={0}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") setEditingId(question.id)
                          }}
                        >
                          {question.text || "Click to add question text..."}
                        </p>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-destructive shrink-0"
                      onClick={() => dispatch({ type: "REMOVE_QUESTION", id: question.id })}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      <span className="sr-only">Delete question</span>
                    </Button>
                  </div>
                ))}
                <Button
                  variant="outline"
                  size="sm"
                  className="w-fit gap-1.5"
                  onClick={() => handleAddQuestion(group.id)}
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add Question
                </Button>
              </div>
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>

      <div className="flex items-center justify-between">
        <Button variant="outline" onClick={handleBack} className="gap-1.5">
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>
        <Button onClick={handleProceed} size="lg" className="gap-2" disabled={enabledCount === 0}>
          Run Model Tests
          <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}
