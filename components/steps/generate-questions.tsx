"use client";

import { useEffect, useRef, useState } from "react";
import { useWorkflow } from "@/lib/workflow-context";
import { WorkflowStep, type TestQuestion } from "@/lib/types";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, Sparkles, Database } from "lucide-react";
import { Button } from "@/components/ui/button";

interface DatasetRow {
  question: string;
  answer: string;
  context?: string;
  source: string;
}

export function GenerateQuestions() {
  const { state, dispatch } = useWorkflow();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState("");
  const hasStarted = useRef(false);

  const failureModes = state.activeFailureModes;

  useEffect(() => {
    if (hasStarted.current) return;
    if (!state.modelConfig) return;
    if (state.questions.length > 0) {
      dispatch({ type: "SET_STEP", step: WorkflowStep.REVIEW });
      return;
    }

    hasStarted.current = true;
    generateQuestions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function fetchDatasetRows(): Promise<Record<string, DatasetRow[]>> {
    const datasetNames = new Set<string>();
    for (const fm of failureModes) {
      if (fm.datasetSource) datasetNames.add(fm.datasetSource);
    }

    const allRows: Record<string, DatasetRow[]> = {};

    await Promise.all(
      Array.from(datasetNames).map(async (datasetName) => {
        try {
          setStatusMessage(
            `Fetching clinical data from ${datasetName}...`,
          );
          const res = await fetch("/api/fetch-dataset", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ datasetName, count: 8 }),
          });
          if (res.ok) {
            const json = await res.json();
            allRows[datasetName] = json.data.rows;
          }
        } catch {
          // Non-fatal: we can still generate questions without dataset grounding
        }
      }),
    );

    return allRows;
  }

  async function generateQuestions() {
    setIsLoading(true);
    setError(null);

    try {
      // Step 1: Fetch clinical dataset rows for grounding
      setStatusMessage("Fetching clinical benchmark data...");
      const datasetRows = await fetchDatasetRows();

      // Step 2: Generate questions using the grounded data
      setStatusMessage("Generating grounded test questions...");
      const res = await fetch("/api/generate-questions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          description: state.modelConfig!.description,
          failureModes,
          datasetRows,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to generate questions");
      }

      const json = await res.json();
      console.log("[v0] generate-questions response:", JSON.stringify(json).substring(0, 500));
      const data = json.data;
      console.log("[v0] data:", JSON.stringify(data).substring(0, 500));
      console.log("[v0] data.categories:", data?.categories?.length, "categories");

      if (!data || !data.categories) {
        throw new Error("Invalid response shape: missing categories. Raw: " + JSON.stringify(json).substring(0, 200));
      }

      const questions: TestQuestion[] = data.categories.flatMap(
        (cat: {
          failureMode: string;
          questions: {
            text: string;
            datasetSource?: string;
            groundTruth?: string;
            demographicVariant?: {
              baseQuestionIndex: number;
              dimension: string;
              value: string;
            };
          }[];
        }) =>
          cat.questions.map((q, i: number) => {
            const baseId = `${cat.failureMode}-${i}`;
            return {
              id: baseId,
              failureMode: cat.failureMode,
              text: q.text,
              enabled: true,
              datasetSource: q.datasetSource,
              groundTruth: q.groundTruth,
              demographicVariant: q.demographicVariant
                ? {
                    baseQuestionId: `${cat.failureMode}-${q.demographicVariant.baseQuestionIndex}`,
                    dimension: q.demographicVariant.dimension,
                    value: q.demographicVariant.value,
                  }
                : undefined,
            };
          }),
      );

      dispatch({ type: "SET_QUESTIONS", questions });
      setIsLoading(false);
      dispatch({ type: "SET_STEP", step: WorkflowStep.REVIEW });
    } catch (generateQuestionsError) {
      setIsLoading(false);
      setError(
        generateQuestionsError instanceof Error
          ? generateQuestionsError?.message
          : "Failed to generate questions",
      );
    }
  }

  return (
    <div className="flex flex-col items-center justify-center gap-6 py-12">
      <Card className="w-full max-w-lg">
        <CardContent className="flex flex-col items-center gap-4 py-10">
          {isLoading && (
            <>
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[hsl(var(--primary))]/10">
                <Loader2 className="h-7 w-7 animate-spin text-[hsl(var(--primary))]" />
              </div>
              <div className="text-center">
                <h3 className="text-lg font-semibold">
                  Generating Test Questions
                </h3>
                <p className="text-sm text-muted-foreground mt-1">
                  {statusMessage ||
                    "Generating questions based on given context..."}
                </p>
              </div>
              <div className="flex flex-wrap justify-center gap-2 mt-2">
                {failureModes.map((fm) => (
                  <span
                    key={fm.id}
                    className="inline-flex items-center gap-1 rounded-full bg-secondary px-2.5 py-0.5 text-xs font-medium text-secondary-foreground"
                  >
                    {fm.datasetSource && (
                      <Database className="h-3 w-3 opacity-60" />
                    )}
                    {fm.label}
                  </span>
                ))}
              </div>
            </>
          )}

          {error && (
            <>
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10">
                <Sparkles className="h-7 w-7 text-destructive" />
              </div>
              <div className="text-center">
                <h3 className="text-lg font-semibold">Generation Failed</h3>
                <p className="text-sm text-destructive mt-1">{error}</p>
              </div>
              <Button
                onClick={() => {
                  hasStarted.current = false;
                  generateQuestions();
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
  );
}
