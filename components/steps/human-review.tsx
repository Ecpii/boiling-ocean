"use client"

import { useState, useMemo } from "react"
import { useWorkflow } from "@/lib/workflow-context"
import { WorkflowStep, FAILURE_MODES, type HumanReview } from "@/lib/types"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Slider } from "@/components/ui/slider"
import { ArrowLeft, ArrowRight, Star, CheckCircle2 } from "lucide-react"

const FLAG_OPTIONS = [
  { id: "incorrect", label: "Incorrect Information" },
  { id: "harmful", label: "Potentially Harmful" },
  { id: "missing-context", label: "Missing Context" },
  { id: "hallucination", label: "Hallucination" },
  { id: "overconfident", label: "Overconfident" },
  { id: "privacy-violation", label: "Privacy Violation" },
]

const SAMPLE_SIZE = 10

export function HumanReviewStep() {
  const { state, dispatch } = useWorkflow()
  const [currentIndex, setCurrentIndex] = useState(0)

  // Select a random sample of responses for human review
  const sampleResponses = useMemo(() => {
    const shuffled = [...state.responses].sort(() => Math.random() - 0.5)
    return shuffled.slice(0, Math.min(SAMPLE_SIZE, shuffled.length))
  }, [state.responses])

  const currentResponse = sampleResponses[currentIndex]
  const existingReview = state.humanReviews.find(
    (r) => r.responseId === currentResponse?.questionId
  )

  const [review, setReview] = useState<HumanReview>(
    existingReview ?? {
      responseId: currentResponse?.questionId ?? "",
      accuracyRating: 3,
      safetyRating: 3,
      overallRating: 3,
      flags: [],
      clinicalContext: "",
    }
  )

  const reviewedCount = state.humanReviews.length
  const modeLabel =
    FAILURE_MODES.find((fm) => fm.id === currentResponse?.failureMode)?.label ?? ""

  function handleFlagToggle(flagId: string) {
    setReview((prev) => ({
      ...prev,
      flags: prev.flags.includes(flagId)
        ? prev.flags.filter((f) => f !== flagId)
        : [...prev.flags, flagId],
    }))
  }

  function handleSaveAndNext() {
    dispatch({
      type: "ADD_HUMAN_REVIEW",
      review: { ...review, responseId: currentResponse.questionId },
    })

    if (currentIndex < sampleResponses.length - 1) {
      const nextResponse = sampleResponses[currentIndex + 1]
      const nextExisting = state.humanReviews.find(
        (r) => r.responseId === nextResponse?.questionId
      )
      setCurrentIndex((i) => i + 1)
      setReview(
        nextExisting ?? {
          responseId: nextResponse?.questionId ?? "",
          accuracyRating: 3,
          safetyRating: 3,
          overallRating: 3,
          flags: [],
          clinicalContext: "",
        }
      )
    }
  }

  function handleBack() {
    dispatch({ type: "SET_STEP", step: WorkflowStep.COLLECT })
  }

  function handleGenerateReport() {
    // Save current review first
    dispatch({
      type: "ADD_HUMAN_REVIEW",
      review: { ...review, responseId: currentResponse.questionId },
    })
    dispatch({ type: "SET_STEP", step: WorkflowStep.REPORT })
  }

  function handleSkipToReport() {
    dispatch({ type: "SET_STEP", step: WorkflowStep.REPORT })
  }

  if (!currentResponse) {
    return (
      <div className="flex flex-col items-center gap-4 py-12">
        <p className="text-muted-foreground">No responses available for review.</p>
        <Button onClick={handleBack}>Go Back</Button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight text-balance">
            Human Review
          </h2>
          <p className="text-muted-foreground mt-1">
            Review {sampleResponses.length} sampled responses. Rate accuracy, safety, and flag issues.
          </p>
        </div>
        <Badge variant="secondary" className="text-sm tabular-nums">
          {currentIndex + 1} / {sampleResponses.length}
        </Badge>
      </div>

      {/* Response card */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Response Review</CardTitle>
            <Badge variant="outline">{modeLabel}</Badge>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {/* Conversation display */}
          <div className="rounded-lg border bg-muted/50 p-4 flex flex-col gap-3 max-h-80 overflow-y-auto">
            {currentResponse.turns.map((turn, i) => (
              <div
                key={i}
                className={`flex flex-col gap-1 ${
                  turn.role === "user" ? "items-start" : "items-end"
                }`}
              >
                <span className="text-xs font-medium text-muted-foreground uppercase">
                  {turn.role === "user" ? "Test Prompt" : "Model Response"}
                </span>
                <div
                  className={`rounded-lg px-3 py-2 text-sm max-w-[85%] ${
                    turn.role === "user"
                      ? "bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]"
                      : "bg-card border text-card-foreground"
                  }`}
                >
                  {turn.content}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Rating controls */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Your Assessment</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          {/* Sliders */}
          <div className="grid gap-5 sm:grid-cols-3">
            <RatingSlider
              label="Accuracy"
              value={review.accuracyRating}
              onChange={(v) => setReview((prev) => ({ ...prev, accuracyRating: v }))}
            />
            <RatingSlider
              label="Safety"
              value={review.safetyRating}
              onChange={(v) => setReview((prev) => ({ ...prev, safetyRating: v }))}
            />
            <RatingSlider
              label="Overall"
              value={review.overallRating}
              onChange={(v) => setReview((prev) => ({ ...prev, overallRating: v }))}
            />
          </div>

          {/* Flags */}
          <div className="flex flex-col gap-2">
            <Label>Flags</Label>
            <div className="grid gap-2 sm:grid-cols-3">
              {FLAG_OPTIONS.map((flag) => (
                <label
                  key={flag.id}
                  className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm cursor-pointer hover:bg-muted transition-colors"
                >
                  <Checkbox
                    checked={review.flags.includes(flag.id)}
                    onCheckedChange={() => handleFlagToggle(flag.id)}
                  />
                  {flag.label}
                </label>
              ))}
            </div>
          </div>

          {/* Clinical context */}
          <div className="flex flex-col gap-2">
            <Label htmlFor="clinicalContext">Clinical Context / Notes</Label>
            <Textarea
              id="clinicalContext"
              value={review.clinicalContext}
              onChange={(e) =>
                setReview((prev) => ({ ...prev, clinicalContext: e.target.value }))
              }
              placeholder="Add any clinical context, corrections, or notes about this response..."
              rows={3}
              className="resize-none"
            />
          </div>
        </CardContent>
      </Card>

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={handleBack} className="gap-1.5">
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
          {reviewedCount > 0 && (
            <Button variant="ghost" onClick={handleSkipToReport} className="text-muted-foreground">
              Skip to Report ({reviewedCount} reviewed)
            </Button>
          )}
        </div>
        <div className="flex items-center gap-2">
          {currentIndex < sampleResponses.length - 1 ? (
            <Button onClick={handleSaveAndNext} className="gap-1.5">
              Save & Next
              <ArrowRight className="h-4 w-4" />
            </Button>
          ) : (
            <Button onClick={handleGenerateReport} size="lg" className="gap-2">
              <CheckCircle2 className="h-4 w-4" />
              Generate Audit Report
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}

function RatingSlider({
  label,
  value,
  onChange,
}: {
  label: string
  value: number
  onChange: (v: number) => void
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <Label className="text-sm">{label}</Label>
        <div className="flex items-center gap-1">
          <Star className="h-3.5 w-3.5 text-[hsl(var(--warning))] fill-[hsl(var(--warning))]" />
          <span className="text-sm font-semibold tabular-nums">{value}</span>
          <span className="text-xs text-muted-foreground">/5</span>
        </div>
      </div>
      <Slider
        value={[value]}
        onValueChange={(v) => onChange(v[0])}
        min={1}
        max={5}
        step={1}
        className="w-full"
      />
    </div>
  )
}
