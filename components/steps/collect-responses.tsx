"use client";

import { useEffect, useRef, useState } from "react";
import { useWorkflow } from "@/lib/workflow-context";
import {
  WorkflowStep,
  type ConversationTurn,
  type ModelResponse,
} from "@/lib/types";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle2, XCircle, ArrowLeft } from "lucide-react";

const MAX_TURNS = 3;
/** How many questions to run at once (parallel collection). Tune down if you hit rate limits. */
const CONCURRENCY = 5;

export function CollectResponses() {
  const { state, dispatch } = useWorkflow();
  const hasStarted = useRef(false);
  const [currentQuestion, setCurrentQuestion] = useState("");
  const [currentMode, setCurrentMode] = useState("");
  const [completedCount, setCompletedCount] = useState(0);
  const [failedCount, setFailedCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [inFlight, setInFlight] = useState(0);

  const enabledQuestions = state.questions.filter(
    (q) => q.enabled && q.text.trim(),
  );
  const totalQuestions = enabledQuestions.length;

  useEffect(() => {
    if (hasStarted.current) return;
    if (state.responses.length > 0) {
      dispatch({ type: "SET_STEP", step: WorkflowStep.HUMAN_REVIEW });
      return;
    }

    hasStarted.current = true;
    collectAllResponses();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function collectOneQuestion(
    q: (typeof enabledQuestions)[0],
  ): Promise<ModelResponse | null> {
    const modeLabel =
      state.activeFailureModes.find((fm) => fm.id === q.failureMode)?.label ??
      q.failureMode;

    const turns: ConversationTurn[] = [];
    const hasGroundTruth = Boolean(q.groundTruth?.trim());
    const res1 = await fetch("/api/run-model", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        provider: state.modelConfig!.provider,
        modelId: state.modelConfig!.modelId,
        question: q.text,
        conversationHistory: [],
        requestConfidence: hasGroundTruth,
      }),
    });
    if (!res1.ok) throw new Error("Model request failed");
    const res1Json = await res1.json();
    const answer1 = res1Json.response;
    const confidenceScore = hasGroundTruth ? res1Json.confidenceScore : undefined;
    turns.push({ role: "user", content: q.text });
    turns.push({ role: "assistant", content: answer1 });

    for (let turn = 1; turn < MAX_TURNS; turn++) {
      try {
        const followUpRes = await fetch("/api/generate-followup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            question: q.text,
            response: answer1,
            failureMode: modeLabel,
          }),
        });
        if (!followUpRes.ok) break;
        const { followUp } = await followUpRes.json();
        const modelRes = await fetch("/api/run-model", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            provider: state.modelConfig!.provider,
            modelId: state.modelConfig!.modelId,
            question: followUp,
            conversationHistory: turns,
          }),
        });
        if (!modelRes.ok) break;
        const { response: followUpAnswer } = await modelRes.json();
        turns.push({ role: "user", content: followUp });
        turns.push({ role: "assistant", content: followUpAnswer });
      } catch {
        break;
      }
    }

    return {
      questionId: q.id,
      question: q.text,
      failureMode: q.failureMode,
      turns,
      ...(confidenceScore != null && { confidenceScore }),
    };
  }

  async function collectAllResponses() {
    setIsLoading(true);
    setCurrentQuestion(`Running up to ${CONCURRENCY} questions in parallel…`);
    setCurrentMode("");

    for (let i = 0; i < enabledQuestions.length; i += CONCURRENCY) {
      const chunk = enabledQuestions.slice(i, i + CONCURRENCY);
      setInFlight(chunk.length);
      setCurrentMode(`Batch ${Math.floor(i / CONCURRENCY) + 1} of ${Math.ceil(enabledQuestions.length / CONCURRENCY)}`);

      const results = await Promise.allSettled(
        chunk.map((q) => collectOneQuestion(q)),
      );

      for (let j = 0; j < results.length; j++) {
        const r = results[j];
        if (r.status === "fulfilled" && r.value) {
          dispatch({ type: "ADD_RESPONSE", response: r.value });
          setCompletedCount((c) => c + 1);
        } else {
          setFailedCount((f) => f + 1);
        }
      }
      setInFlight(0);
    }

    setCurrentQuestion("");
    setCurrentMode("");
    setIsLoading(false);

    setTimeout(() => {
      dispatch({ type: "SET_STEP", step: WorkflowStep.HUMAN_REVIEW });
    }, 1500);
  }

  function handleBack() {
    dispatch({ type: "SET_RESPONSES", responses: [] });
    dispatch({ type: "SET_STEP", step: WorkflowStep.REVIEW });
  }

  const progressPercent =
    totalQuestions > 0
      ? ((completedCount + failedCount) / totalQuestions) * 100
      : 0;

  return (
    <div className="flex flex-col items-center gap-6 py-8">
      <Card className="w-full max-w-2xl">
        <CardContent className="flex flex-col gap-6 py-8">
          <div className="text-center">
            <h2 className="text-2xl font-semibold tracking-tight">
              Collecting Model Responses
            </h2>
            <p className="text-muted-foreground mt-1">
              Testing your model with {totalQuestions} questions across{" "}
              {state.activeFailureModes.length} failure modes
            </p>
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Progress</span>
              <span className="font-medium tabular-nums">
                {completedCount + failedCount} / {totalQuestions}
              </span>
            </div>
            <Progress value={progressPercent} className="h-2" />
          </div>

          {isLoading && (
            <div className="rounded-lg border bg-background p-4">
              <div className="flex items-start gap-3">
                <Loader2 className="h-5 w-5 animate-spin text-[hsl(var(--primary))] shrink-0 mt-0.5" />
                <div className="min-w-0">
                  {currentMode && (
                    <Badge variant="outline" className="mb-2">
                      {currentMode}
                    </Badge>
                  )}
                  <p className="text-sm text-muted-foreground">
                    {currentQuestion || "Collecting responses…"}
                  </p>
                  {inFlight > 0 && (
                    <p className="text-xs text-muted-foreground mt-1">
                      {inFlight} question{inFlight !== 1 ? "s" : ""} in progress
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          <div className="flex items-center justify-center gap-6 text-sm">
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="h-4 w-4 text-[hsl(var(--accent))]" />
              <span className="tabular-nums">{completedCount} completed</span>
            </div>
            {failedCount > 0 && (
              <div className="flex items-center gap-1.5">
                <XCircle className="h-4 w-4 text-destructive" />
                <span className="tabular-nums">{failedCount} failed</span>
              </div>
            )}
          </div>

          {!isLoading && progressPercent === 100 && (
            <div className="text-center">
              <p className="text-sm font-medium text-[hsl(var(--accent))]">
                All responses collected. Proceeding to human review...
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {!isLoading && (
        <Button variant="outline" onClick={handleBack} className="gap-1.5">
          <ArrowLeft className="h-4 w-4" />
          Back to Questions
        </Button>
      )}
    </div>
  );
}
