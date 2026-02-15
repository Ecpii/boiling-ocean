"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useWorkflow } from "@/lib/workflow-context";
import {
  WorkflowStep,
  type GoldenAnswer,
} from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Loader2,
  Sparkles,
  PenLine,
  AlertCircle,
} from "lucide-react";

export function HumanReviewStep() {
  const { state, dispatch } = useWorkflow();
  const [currentModeIndex, setCurrentModeIndex] = useState(0);
  const [goldenText, setGoldenText] = useState("");
  const [sampleQuestion, setSampleQuestion] = useState("");
  const [sampleAnswer, setSampleAnswer] = useState("");
  const [isComputingSimilarity, setIsComputingSimilarity] = useState(false);
  const [sampleGenerated, setSampleGenerated] = useState(false);
  const [sampleError, setSampleError] = useState<string | null>(null);
  const [similarityError, setSimilarityError] = useState<string | null>(null);
  /** Cached samples per failure mode id — populated once sequentially, never re-fetched on tab switch */
  const [sampleCache, setSampleCache] = useState<Record<string, { question: string; answer: string }>>({});
  const [samplesLoading, setSamplesLoading] = useState(true);
  const [samplesLoadedCount, setSamplesLoadedCount] = useState(0);
  const samplesStartedRef = useRef(false);

  const failureModes = state.activeFailureModes;
  const safeIndex = Math.min(currentModeIndex, Math.max(0, failureModes.length - 1));
  const currentMode = failureModes[safeIndex];
  const existingGolden = currentMode
    ? state.goldenAnswers.find((g) => g.failureMode === currentMode.id)
    : undefined;
  const completedCount = state.goldenAnswers.length;

  const loadExistingIfPresent = useCallback(
    (modeIndex: number) => {
      const mode = failureModes[modeIndex];
      if (!mode) return;
      const existing = state.goldenAnswers.find(
        (g) => g.failureMode === mode.id,
      );
      if (existing) {
        setGoldenText(existing.goldenAnswer);
        setSampleQuestion(existing.sampleQuestion);
        setSampleAnswer(existing.sampleAnswer);
        setSampleGenerated(true);
        setSampleError(null);
      } else {
        const cached = sampleCache[mode.id];
        if (cached) {
          setGoldenText("");
          setSampleQuestion(cached.question);
          setSampleAnswer(cached.answer);
          setSampleGenerated(true);
          setSampleError(null);
        } else {
          setGoldenText("");
          setSampleQuestion("");
          setSampleAnswer("");
          setSampleGenerated(false);
          setSampleError(null);
        }
      }
      setSimilarityError(null);
    },
    [state.goldenAnswers, failureModes, sampleCache],
  );

  // Generate all samples sequentially on mount (once); cache so tab switches don't re-prompt
  useEffect(() => {
    if (samplesStartedRef.current) return;
    samplesStartedRef.current = true;
    if (failureModes.length === 0) {
      setSamplesLoading(false);
      return;
    }

    const toFetch = failureModes.filter(
      (mode) => !state.goldenAnswers.some((g) => g.failureMode === mode.id),
    );
    if (toFetch.length === 0) {
      setSamplesLoading(false);
      return;
    }

    const description = state.modelConfig?.description ?? "";

    (async () => {
      for (const mode of toFetch) {
        try {
          const res = await fetch("/api/generate-sample", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ failureMode: mode, description }),
          });
          const json = await res.json();
          if (res.ok && json.data) {
            setSampleCache((prev) => ({
              ...prev,
              [mode.id]: { question: json.data.question, answer: json.data.answer },
            }));
            setSamplesLoadedCount((c) => c + 1);
          }
        } catch {
          // Non-fatal: skip this mode
        }
      }
      setSamplesLoading(false);
    })();
  }, [failureModes, state.goldenAnswers]);

  // When cache or golden answers change, sync current tab content
  useEffect(() => {
    loadExistingIfPresent(currentModeIndex);
  }, [currentModeIndex, loadExistingIfPresent]);

  // Clamp index when failure modes list shrinks (e.g. after reconfig) to avoid undefined currentMode
  useEffect(() => {
    if (failureModes.length > 0 && currentModeIndex >= failureModes.length) {
      setCurrentModeIndex(Math.max(0, failureModes.length - 1));
    }
  }, [failureModes.length, currentModeIndex]);

  const generateSample = useCallback(async () => {
    if (!currentMode) return;
    setSampleError(null);
    try {
      const mode = currentMode;
      const res = await fetch("/api/generate-sample", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          failureMode: mode,
          description: state.modelConfig?.description ?? "",
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to generate sample");
      const { question, answer } = json.data;
      setSampleCache((prev) => ({ ...prev, [mode.id]: { question, answer } }));
      setSampleQuestion(question);
      setSampleAnswer(answer);
      setSampleGenerated(true);
    } catch (err) {
      setSampleError(
        err instanceof Error ? err.message : "Failed to generate sample",
      );
    }
  }, [currentModeIndex, state.modelConfig?.description, failureModes]);

  function handleSaveGolden() {
    const golden: GoldenAnswer = {
      failureMode: currentMode.id,
      sampleQuestion,
      sampleAnswer,
      goldenAnswer: goldenText.trim(),
    };
    dispatch({ type: "ADD_GOLDEN_ANSWER", goldenAnswer: golden });

    if (currentModeIndex < failureModes.length - 1) {
      const nextIndex = currentModeIndex + 1;
      setCurrentModeIndex(nextIndex);
      loadExistingIfPresent(nextIndex);
    }
  }

  function handlePrev() {
    if (currentModeIndex > 0) {
      const prevIndex = currentModeIndex - 1;
      setCurrentModeIndex(prevIndex);
      loadExistingIfPresent(prevIndex);
    }
  }

  function handleNavigateToMode(index: number) {
    setCurrentModeIndex(index);
    loadExistingIfPresent(index);
  }

  async function handleFinish() {
    // Save current golden if filled
    if (goldenText.trim() && sampleGenerated) {
      dispatch({
        type: "ADD_GOLDEN_ANSWER",
        goldenAnswer: {
          failureMode: currentMode.id,
          sampleQuestion,
          sampleAnswer,
          goldenAnswer: goldenText.trim(),
        },
      });
    }

    // Compute similarity scores
    setIsComputingSimilarity(true);
    setSimilarityError(null);
    try {
      const allGolden = [...state.goldenAnswers];
      // Include the current one if not yet saved
      if (
        goldenText.trim() &&
        sampleGenerated &&
        !allGolden.find((g) => g.failureMode === currentMode.id)
      ) {
        allGolden.push({
          failureMode: currentMode.id,
          sampleQuestion,
          sampleAnswer,
          goldenAnswer: goldenText.trim(),
        });
      }

      const res = await fetch("/api/compute-similarity", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          goldenAnswers: allGolden,
          responses: state.responses,
        }),
      });
      const json = await res.json();
      if (!res.ok)
        throw new Error(json.error || "Failed to compute similarity");
      dispatch({ type: "SET_SIMILARITY_RESULTS", results: json.data });

      // Citation check: last assistant turn per response
      const citationPayload = state.responses.map((r) => {
        const lastAssistant = r.turns.filter((t) => t.role === "assistant").pop();
        return { questionId: r.questionId, text: lastAssistant?.content ?? "" };
      });
      const citeRes = await fetch("/api/citation-check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ responses: citationPayload }),
      });
      if (citeRes.ok) {
        const citeJson = await citeRes.json();
        dispatch({ type: "SET_CITATION_CHECK_RESULTS", results: citeJson.data });
      }

      // UMLS concept validation (optional; requires UMLS_API_KEY)
      const umlsPayload = state.responses.map((r) => {
        const lastAssistant = r.turns.filter((t) => t.role === "assistant").pop();
        return { questionId: r.questionId, failureMode: r.failureMode, text: lastAssistant?.content ?? "" };
      });
      const umlsRes = await fetch("/api/umls-validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ responses: umlsPayload }),
      });
      if (umlsRes.ok) {
        const umlsJson = await umlsRes.json();
        dispatch({ type: "SET_UMLS_VALIDATION_RESULTS", results: umlsJson.data });
      }

      const multiStepRes = await fetch("/api/multi-step-analysis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          responses: state.responses.map((r) => ({ questionId: r.questionId, turns: r.turns })),
        }),
      });
      if (multiStepRes.ok) {
        const multiStepJson = await multiStepRes.json();
        dispatch({ type: "SET_MULTI_STEP_REASONING_RESULTS", results: multiStepJson.data });
      }

      dispatch({ type: "SET_STEP", step: WorkflowStep.REPORT });
    } catch (err) {
      setSimilarityError(
        err instanceof Error ? err.message : "Failed to compute similarity",
      );
    } finally {
      setIsComputingSimilarity(false);
    }
  }

  function handleBack() {
    dispatch({ type: "SET_STEP", step: WorkflowStep.COLLECT });
  }

  const canSave = goldenText.trim().length > 0 && sampleGenerated;
  const isLastMode = safeIndex === failureModes.length - 1;
  const allModesCompleted = completedCount >= failureModes.length;

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight text-balance">
            Golden Answer Review
          </h2>
          <p className="text-muted-foreground mt-1">
            For each failure mode, review a sample Q&A and write your ideal
            &ldquo;golden answer&rdquo; demonstrating the correct tone and form.
          </p>
        </div>
        <Badge variant="secondary" className="text-sm tabular-nums">
          {completedCount} / {failureModes.length}
        </Badge>
      </div>

      {/* Mode navigation pills */}
      <div className="flex flex-wrap gap-2">
        {failureModes.map((mode, i) => {
          const isDone = state.goldenAnswers.some(
            (g) => g.failureMode === mode.id,
          );
          const isCurrent = i === safeIndex;
          return (
            <button
              key={mode.id}
              onClick={() => handleNavigateToMode(i)}
              className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                isCurrent
                  ? "bg-primary text-primary-foreground"
                  : isDone
                    ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
            >
              {isDone && <CheckCircle2 className="h-3 w-3" />}
              {mode.label}
            </button>
          );
        })}
      </div>

      {/* Current failure mode info */}
      {!currentMode ? (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            No failure modes to review. Complete Configure to add failure modes.
          </CardContent>
        </Card>
      ) : (
        <>
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">{currentMode.label}</CardTitle>
            <Badge variant="outline" className="font-normal">
              {safeIndex + 1} of {failureModes.length}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            {currentMode.description}
          </p>
        </CardHeader>
      </Card>

      {/* Sample Q&A section */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <Sparkles className="h-4 w-4 text-amber-500" />
              Sample Question & Answer
            </CardTitle>
            {samplesLoading && (
              <Badge variant="secondary" className="gap-1.5 font-normal">
                <Loader2 className="h-3 w-3 animate-spin" />
                {samplesLoadedCount > 0
                  ? `${samplesLoadedCount}/${failureModes.length} ready`
                  : "Generating all samples…"}
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {sampleError && (
            <div className="flex items-start gap-2 rounded-lg border border-destructive/50 bg-destructive/10 p-3 mb-4">
              <AlertCircle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
              <div className="flex flex-col gap-2">
                <p className="text-sm text-destructive">{sampleError}</p>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => generateSample()}
                  className="w-fit gap-1.5"
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  Retry
                </Button>
              </div>
            </div>
          )}

          {samplesLoading && !sampleGenerated && (
            <div className="flex flex-col items-center gap-3 py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                Generating samples for each failure mode (one at a time)…
              </p>
              <p className="text-xs text-muted-foreground">
                Switching tabs won’t re-prompt; samples are cached.
              </p>
            </div>
          )}

          {sampleGenerated && (
            <div className="flex flex-col gap-4">
              <div className="rounded-lg border bg-muted/50 p-4 flex flex-col gap-3">
                {/* Sample question */}
                <div className="flex flex-col gap-1">
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Sample Question
                  </span>
                  <div className="rounded-lg bg-primary px-3 py-2 text-sm text-primary-foreground">
                    {sampleQuestion}
                  </div>
                </div>
                {/* Sample ideal answer */}
                <div className="flex flex-col gap-1">
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Sample Ideal Answer
                  </span>
                  <div className="rounded-lg border bg-card px-3 py-2 text-sm text-card-foreground">
                    {sampleAnswer}
                  </div>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                This sample is independently generated and not from the model
                under evaluation. Use it as inspiration for writing your golden
                answer below.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Golden answer input */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <PenLine className="h-4 w-4" />
            Your Golden Answer
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Write your ideal answer for the &ldquo;{currentMode.label}&rdquo;
            category. This defines the standard that the model&rsquo;s actual
            responses will be compared against using semantic similarity.
          </p>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-3">
            <Label htmlFor="goldenAnswer" className="sr-only">
              Golden Answer
            </Label>
            <Textarea
              id="goldenAnswer"
              value={goldenText}
              onChange={(e) => setGoldenText(e.target.value)}
              placeholder={
                sampleGenerated
                  ? "Write your ideal response here. Use the sample above as a guide for the appropriate tone, level of detail, and safety awareness..."
                  : "Waiting for the sample to generate..."
              }
              rows={6}
              className="resize-y"
              disabled={!sampleGenerated}
            />
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground tabular-nums">
                {goldenText.length} characters
              </span>
              {existingGolden && (
                <Badge
                  variant="outline"
                  className="text-emerald-600 border-emerald-300"
                >
                  <CheckCircle2 className="h-3 w-3 mr-1" />
                  Saved
                </Badge>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Similarity error */}
      {similarityError && (
        <div className="flex items-start gap-2 rounded-lg border border-destructive/50 bg-destructive/10 p-3">
          <AlertCircle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
          <p className="text-sm text-destructive">{similarityError}</p>
        </div>
      )}

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={handleBack} className="gap-1.5">
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
          {currentModeIndex > 0 && (
            <Button
              variant="ghost"
              onClick={handlePrev}
              className="gap-1.5 text-muted-foreground"
            >
              <ArrowLeft className="h-4 w-4" />
              Previous Mode
            </Button>
          )}
        </div>
        <div className="flex items-center gap-2">
          {!isLastMode && (
            <Button
              onClick={handleSaveGolden}
              disabled={!canSave}
              className="gap-1.5"
            >
              Save & Next
              <ArrowRight className="h-4 w-4" />
            </Button>
          )}
          {(isLastMode || allModesCompleted) && (
            <Button
              onClick={handleFinish}
              disabled={!canSave && !allModesCompleted || isComputingSimilarity}
              size="lg"
              className="gap-2"
            >
              {isComputingSimilarity ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Computing Similarity...
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4" />
                  Compute Similarity & Generate Report
                </>
              )}
            </Button>
          )}
        </div>
      </div>
        </>
      )}
    </div>
  );
}
