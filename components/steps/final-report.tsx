"use client";

import { useEffect, useRef, useState } from "react";
import { useWorkflow } from "@/lib/workflow-context";
import { WorkflowStep, CATEGORY_LABELS, type AuditReport } from "@/lib/types";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import {
  Bar,
  BarChart,
  XAxis,
  YAxis,
  CartesianGrid,
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
} from "recharts";
import {
  Loader2,
  Download,
  ShieldAlert,
  ShieldCheck,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  ArrowLeft,
  RotateCcw,
} from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

const chartConfig: ChartConfig = {
  score: {
    label: "Score",
    color: "hsl(var(--chart-1))",
  },
};

export function FinalReport() {
  const { state, dispatch, resetWorkflow } = useWorkflow();
  const hasStarted = useRef(false);
  const [expandedFailures, setExpandedFailures] = useState<Set<number>>(
    new Set(),
  );
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<null | string>(null);

  useEffect(() => {
    if (hasStarted.current) return;
    if (state.report) return;

    hasStarted.current = true;
    generateReport();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function generateReport() {
    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/evaluate-responses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          responses: state.responses,
          questions: state.questions,
          similarityResults: state.similarityResults,
          goldenAnswers: state.goldenAnswers,
          citationCheckResults: state.citationCheckResults ?? undefined,
          umlsValidationResults: state.umlsValidationResults ?? undefined,
          multiStepReasoningResults: state.multiStepReasoningResults ?? undefined,
          description: state.modelConfig!.description,
          activeFailureModes: state.activeFailureModes,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to generate report");
      }

      const { data } = await res.json();
      dispatch({ type: "SET_REPORT", report: data as AuditReport });
      setIsLoading(false);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to generate report",
      );
      setIsLoading(false);
    }
  }

  function toggleFailure(index: number) {
    setExpandedFailures((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  }

  function exportReport() {
    if (!state.report) return;
    const blob = new Blob([JSON.stringify(state.report, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `safety-audit-report-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  // Loading state
  if (isLoading) {
    return (
      <div className="flex flex-col items-center gap-6 py-12">
        <Card className="w-full max-w-lg">
          <CardContent className="flex flex-col items-center gap-4 py-10">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[hsl(var(--primary))]/10">
              <Loader2 className="h-7 w-7 animate-spin text-[hsl(var(--primary))]" />
            </div>
            <div className="text-center">
              <h3 className="text-lg font-semibold">Generating Audit Report</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Claude is analyzing all responses and golden answer similarity
                scores to produce your safety report...
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="flex flex-col items-center gap-6 py-12">
        <Card className="w-full max-w-lg">
          <CardContent className="flex flex-col items-center gap-4 py-10">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10">
              <AlertTriangle className="h-7 w-7 text-destructive" />
            </div>
            <div className="text-center">
              <h3 className="text-lg font-semibold">
                Report Generation Failed
              </h3>
              <p className="text-sm text-destructive mt-1">{error}</p>
            </div>
            <Button
              onClick={() => {
                hasStarted.current = false;
                generateReport();
              }}
              variant="outline"
            >
              Retry
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!state.report) return null;

  const report = state.report;

  const scoreColor =
    report.overallSafetyScore >= 80
      ? "text-[hsl(var(--accent))]"
      : report.overallSafetyScore >= 50
        ? "text-[hsl(var(--warning))]"
        : "text-destructive";

  const scoreBg =
    report.overallSafetyScore >= 80
      ? "bg-[hsl(var(--accent))]/10"
      : report.overallSafetyScore >= 50
        ? "bg-[hsl(var(--warning))]/10"
        : "bg-destructive/10";

  const ScoreIcon = report.overallSafetyScore >= 80 ? ShieldCheck : ShieldAlert;

  // Chart data
  const failureModes = state.activeFailureModes;
  const barData = report.categoryBreakdowns.map((cat) => {
    const mode = failureModes.find((fm) => fm.id === cat.failureMode);
    return {
      name: mode?.label ?? cat.label,
      score: cat.score,
      fill:
        cat.score >= 80
          ? "hsl(var(--chart-2))"
          : cat.score >= 50
            ? "hsl(var(--chart-4))"
            : "hsl(var(--chart-3))",
    };
  });

  const radarData = report.categoryBreakdowns.map((cat) => {
    const mode = failureModes.find((fm) => fm.id === cat.failureMode);
    return {
      category: mode?.label ?? cat.label,
      score: cat.score,
    };
  });

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight text-balance">
            Safety Audit Report
          </h2>
          <p className="text-muted-foreground mt-1">
            Comprehensive evaluation of {state.modelConfig?.modelId} (
            {state.modelConfig?.provider})
            {state.categoryClassification && (
              <> | {CATEGORY_LABELS[state.categoryClassification.category]}</>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={exportReport}
            className="gap-1.5"
          >
            <Download className="h-3.5 w-3.5" />
            Export
          </Button>
        </div>
      </div>

      {/* Overall score */}
      <Card>
        <CardContent className="flex items-center gap-6 py-6">
          <div
            className={`flex h-20 w-20 items-center justify-center rounded-2xl ${scoreBg} shrink-0`}
          >
            <ScoreIcon className={`h-10 w-10 ${scoreColor}`} />
          </div>
          <div className="flex-1">
            <div className="flex items-baseline gap-2">
              <span className={`text-4xl font-bold tabular-nums ${scoreColor}`}>
                {report.overallSafetyScore}
              </span>
              <span className="text-lg text-muted-foreground">/ 100</span>
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              Overall Safety Score
            </p>
          </div>
          <div className="hidden sm:flex items-center gap-4 text-sm">
            <div className="text-center">
              <p className="font-semibold tabular-nums">
                {report.criticalFailures.length}
              </p>
              <p className="text-muted-foreground">Critical Issues</p>
            </div>
            <div className="h-8 w-px bg-border" />
            <div className="text-center">
              <p className="font-semibold tabular-nums">
                {report.goldenAnswerSimilarity && report.goldenAnswerSimilarity.length > 0
                  ? `${(
                      (report.goldenAnswerSimilarity.reduce((s, g) => s + g.averageSimilarity, 0) /
                        report.goldenAnswerSimilarity.length) *
                      100
                    ).toFixed(0)}%`
                  : "N/A"}
              </p>
              <p className="text-muted-foreground">Avg Similarity</p>
            </div>
            <div className="h-8 w-px bg-border" />
            <div className="text-center">
              <p className="font-semibold tabular-nums">
                {state.responses.length}
              </p>
              <p className="text-muted-foreground">Tests Run</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Foundational metrics: data governance, PII, limitations, UMLS ref, helpfulness (similarity) */}
      <Card>
        <CardHeader>
          <CardTitle>Foundational Metrics</CardTitle>
          <CardDescription>
            Data governance (PII, limitations), UMLS vocabulary cross-reference, and helpfulness (expert-aligned passage quality, e.g. PubMedBERT/BERTScore-style).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="flex flex-col gap-2 text-sm text-muted-foreground">
            <li>• Citation transparency and UMLS concept accuracy are reported in their sections above/below.</li>
            <li>• Helpfulness (how well responses match expert ideal) is reflected in the Golden Answer Similarity and Score Breakdown (similarity %).</li>
            <li>• Data governance (PII avoidance, stating limitations) is addressed in the Executive Summary when relevant.</li>
          </ul>
        </CardContent>
      </Card>

      {/* Real-time score (0-100) and scoring breakdown — accuracy + similarity separate */}
      {(report.realTimeScore != null || (report.scoringBreakdown && Object.keys(report.scoringBreakdown).length > 0)) && (
        <Card>
          <CardHeader>
            <CardTitle>Score Breakdown (out of 100)</CardTitle>
            <CardDescription>
              Separate metrics: accuracy (ground truth), similarity (golden answer), citations. Real-time style aggregate.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-4">
              {report.realTimeScore != null && (
                <div className="flex items-center gap-3">
                  <span className="text-3xl font-bold tabular-nums">{report.realTimeScore}</span>
                  <span className="text-muted-foreground">/ 100</span>
                </div>
              )}
              {report.scoringBreakdown && Object.keys(report.scoringBreakdown).length > 0 && (
                <div className="flex flex-wrap gap-4">
                  {Object.entries(report.scoringBreakdown).map(([key, value]) => (
                    <div key={key} className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground capitalize">
                        {key.replace(/Pct$/, "")}
                      </span>
                      <Badge variant="secondary" className="tabular-nums">
                        {typeof value === "number" ? value.toFixed(1) : value}%
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Summary */}
      <Card>
        <CardHeader>
          <CardTitle>Executive Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line">
            {report.summary}
          </p>
        </CardContent>
      </Card>

      {/* Charts */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Category Scores</CardTitle>
            <CardDescription>
              Safety score by failure mode (0-100)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="aspect-[4/3]">
              <BarChart data={barData} layout="vertical" margin={{ left: 20 }}>
                <CartesianGrid horizontal={false} />
                <XAxis type="number" domain={[0, 100]} />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={120}
                  tick={{ fontSize: 11 }}
                />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="score" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Safety Radar</CardTitle>
            <CardDescription>Coverage across all failure modes</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="aspect-[4/3]">
              <RadarChart data={radarData}>
                <PolarGrid />
                <PolarAngleAxis dataKey="category" tick={{ fontSize: 10 }} />
                <PolarRadiusAxis domain={[0, 100]} tick={{ fontSize: 10 }} />
                <Radar
                  name="Score"
                  dataKey="score"
                  stroke="hsl(var(--chart-1))"
                  fill="hsl(var(--chart-1))"
                  fillOpacity={0.3}
                />
                <ChartTooltip content={<ChartTooltipContent />} />
              </RadarChart>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>

      {/* Golden Answer Similarity */}
      {report.goldenAnswerSimilarity && report.goldenAnswerSimilarity.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Golden Answer Similarity</CardTitle>
            <CardDescription>
              How closely the model&apos;s responses match human-defined ideal
              answers, measured via PubMedBERT semantic similarity.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-3">
              {report.goldenAnswerSimilarity.map((sim) => {
                const pct = sim.averageSimilarity * 100;
                const barColor =
                  pct >= 80
                    ? "bg-emerald-500"
                    : pct >= 60
                      ? "bg-amber-500"
                      : "bg-destructive";
                return (
                  <div key={sim.failureMode} className="flex flex-col gap-1.5">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium">{sim.label}</span>
                      <span className="tabular-nums font-semibold">
                        {pct.toFixed(1)}%
                      </span>
                    </div>
                    <div className="h-2.5 w-full rounded-full bg-muted overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${barColor}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Citation transparency */}
      {report.citationResults && (
        <Card>
          <CardHeader>
            <CardTitle>Citation Transparency</CardTitle>
            <CardDescription>
              Whether responses cited sources (PMID) and had no uncited
              references. Citations must be transparent and noted.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <Badge
                  variant={report.citationResults.allTransparent ? "default" : "destructive"}
                  className="text-sm"
                >
                  {report.citationResults.allTransparent ? "Yes" : "No"}
                </Badge>
                <span className="text-sm text-muted-foreground">
                  All responses cite transparently:{" "}
                  {report.citationResults.allTransparent
                    ? "All responses have valid citations and no uncited references."
                    : "Some responses have invalid PMIDs or uncited references."}
                </span>
              </div>
              <div className="rounded-lg border bg-muted/30 p-3">
                <p className="text-xs font-medium text-muted-foreground mb-2">
                  Per response
                </p>
                <ul className="flex flex-col gap-1.5 text-sm">
                  {report.citationResults.perResponse.map((r) => {
                    const resp = state.responses.find((x) => x.questionId === r.questionId);
                    const label = resp?.question?.slice(0, 50) ?? r.questionId;
                    return (
                      <li key={r.questionId} className="flex items-center gap-2">
                        <Badge
                          variant={r.citationsTransparentAndNoted ? "secondary" : "destructive"}
                          className="shrink-0"
                        >
                          {r.citationsTransparentAndNoted ? "Yes" : "No"}
                        </Badge>
                        <span className="truncate text-muted-foreground" title={resp?.question}>
                          {label}
                          {label.length >= 50 ? "…" : ""}
                        </span>
                        {!r.citationsTransparentAndNoted && (
                          <span className="text-xs text-destructive shrink-0">
                            {r.invalidPmids?.length
                              ? `${r.invalidPmids.length} invalid PMID(s)`
                              : ""}
                            {r.invalidPmids?.length && r.uncitedReferences?.length ? "; " : ""}
                            {r.uncitedReferences?.length
                              ? `${r.uncitedReferences.length} uncited ref(s)`
                              : ""}
                          </span>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Confidence calibration (ECE, reliability diagram) */}
      {report.calibrationResults && report.calibrationResults.bins.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Confidence Calibration (Reliability Diagram)</CardTitle>
            <CardDescription>
              For questions with ground truth: model confidence (1–100) vs actual
              accuracy. Well-calibrated models have confidence close to accuracy.
              ECE = Expected Calibration Error (lower is better). 5 bins.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-4">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">ECE</span>
                <Badge variant="outline" className="tabular-nums">
                  {(report.calibrationResults.ece * 100).toFixed(1)}%
                </Badge>
              </div>
              <ChartContainer config={chartConfig} className="aspect-[4/3]">
                <BarChart
                  data={report.calibrationResults.bins.map((b) => ({
                    bin: `${b.binMin}-${b.binMax}`,
                    avgConfidence: Math.round(b.avgConfidence),
                    accuracy: Math.round(b.accuracy * 100),
                    count: b.count,
                  }))}
                  margin={{ left: 12, right: 12 }}
                >
                  <CartesianGrid horizontal={false} />
                  <XAxis dataKey="bin" tick={{ fontSize: 10 }} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} />
                  <ChartTooltip
                    content={
                      <ChartTooltipContent
                        formatter={(v) => `${v}%`}
                        labelFormatter={(_, payload) =>
                          payload?.[0]?.payload
                            ? `Bin ${payload[0].payload.bin} (n=${payload[0].payload.count})`
                            : ""
                        }
                      />
                    }
                  />
                  <Bar
                    dataKey="avgConfidence"
                    name="Avg confidence"
                    fill="hsl(var(--chart-1))"
                    radius={[2, 2, 0, 0]}
                  />
                  <Bar
                    dataKey="accuracy"
                    name="Accuracy"
                    fill="hsl(var(--chart-2))"
                    radius={[2, 2, 0, 0]}
                  />
                </BarChart>
              </ChartContainer>
              <p className="text-xs text-muted-foreground">
                Blue = average confidence in bin; Green = actual accuracy in bin.
                Gaps indicate miscalibration.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Multi-step reasoning: per-conversation analysis, aggregated */}
      {report.multiStepReasoning && report.multiStepReasoning.perConversation?.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Multi-Step Reasoning</CardTitle>
            <CardDescription>
              Each conversation analyzed separately; each step scored for usefulness and correctness. Scores aggregated in a statistically sound way (mean per conversation, then mean across).
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-4">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">Overall score</span>
                <Badge variant="outline" className="tabular-nums">
                  {report.multiStepReasoning.overallScore}/100
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">{report.multiStepReasoning.summary}</p>
              <div className="rounded-lg border bg-muted/30 p-3 max-h-48 overflow-y-auto">
                <p className="text-xs font-medium text-muted-foreground mb-2">Per conversation</p>
                <ul className="flex flex-col gap-1 text-sm">
                  {report.multiStepReasoning.perConversation.slice(0, 15).map((c) => (
                    <li key={c.questionId} className="flex items-center gap-2">
                      <span className="truncate text-muted-foreground">{c.questionId}</span>
                      <Badge variant="secondary" className="shrink-0 tabular-nums">
                        {c.aggregateScore} (steps: {c.stepScores.join(", ")})
                      </Badge>
                    </li>
                  ))}
                  {report.multiStepReasoning.perConversation.length > 15 && (
                    <li className="text-xs text-muted-foreground">
                      +{report.multiStepReasoning.perConversation.length - 15} more
                    </li>
                  )}
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Guideline adherence (separate section): 5 guidelines, Class I, keyword+LLM */}
      {report.guidelineAdherence && report.guidelineAdherence.byGuideline?.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Guideline Adherence</CardTitle>
            <CardDescription>
              Adherence to 5 high-impact clinical guidelines (heart failure, diabetes, hypertension, atrial fibrillation, pneumonia) — Class I recommendations, keyword-based match.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-4">
              <p className="text-sm text-muted-foreground">{report.guidelineAdherence.summary}</p>
              <ul className="flex flex-col gap-3">
                {report.guidelineAdherence.byGuideline.map((g) => (
                  <li key={g.guideline} className="rounded-lg border p-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium">{g.guideline}</span>
                      <Badge variant="outline" className="tabular-nums">
                        {g.adherenceScore.toFixed(0)}% ({g.matched}/{g.total})
                      </Badge>
                    </div>
                    {g.details?.length > 0 && (
                      <ul className="text-xs text-muted-foreground list-disc list-inside">
                        {g.details.slice(0, 3).map((d, i) => (
                          <li key={i} className="truncate">{d}</li>
                        ))}
                      </ul>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          </CardContent>
        </Card>
      )}

      {/* UMLS concept accuracy (per response and per failure mode) */}
      {report.umlsConceptAccuracy && (
        <Card>
          <CardHeader>
            <CardTitle>UMLS Concept Accuracy</CardTitle>
            <CardDescription>
              Medical terms in responses validated against the Unified Medical Language System (vocabulary cross-reference). Per response and per failure mode.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-4">
              <p className="text-sm text-muted-foreground">{report.umlsConceptAccuracy.summary}</p>
              {report.umlsConceptAccuracy.perFailureMode?.length > 0 && (
                <div className="rounded-lg border p-3">
                  <p className="text-xs font-medium text-muted-foreground mb-2">By failure mode</p>
                  <ul className="flex flex-wrap gap-2">
                    {report.umlsConceptAccuracy.perFailureMode.map((m) => (
                      <li key={m.failureMode}>
                        <Badge variant="outline" className="tabular-nums">
                          {m.failureMode}: {m.avgScorePct.toFixed(0)}% (n={m.responseCount})
                        </Badge>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {report.umlsConceptAccuracy.perResponse?.length > 0 && (
                <div className="rounded-lg border bg-muted/30 p-3 max-h-48 overflow-y-auto">
                  <p className="text-xs font-medium text-muted-foreground mb-2">Per response</p>
                  <ul className="flex flex-col gap-1 text-sm">
                    {report.umlsConceptAccuracy.perResponse.slice(0, 20).map((r) => (
                      <li key={r.questionId} className="flex items-center gap-2">
                        <span className="truncate text-muted-foreground">{r.questionId}</span>
                        <Badge variant="secondary" className="shrink-0 tabular-nums">
                          {r.validConcepts}/{r.totalConcepts} ({r.scorePct.toFixed(0)}%)
                        </Badge>
                      </li>
                    ))}
                    {report.umlsConceptAccuracy.perResponse.length > 20 && (
                      <li className="text-xs text-muted-foreground">
                        +{report.umlsConceptAccuracy.perResponse.length - 20} more
                      </li>
                    )}
                  </ul>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Demographic disparity: accuracy by age/gender with diagrams */}
      {report.demographicDisparity && Object.keys(report.demographicDisparity.byDimension).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Demographic Disparity (Accuracy by Variant)</CardTitle>
            <CardDescription>
              Accuracy disparity across demographic variants (age, gender). Same scenario, different wording only.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-4">
              <p className="text-sm text-muted-foreground">{report.demographicDisparity.summary}</p>
              {Object.entries(report.demographicDisparity.byDimension).map(([dimension, rows]) => {
                const chartData = rows.map((r) => ({
                  name: r.value,
                  accuracy: r.accuracyPct,
                  count: r.count,
                  correct: r.correct,
                }))
                return (
                  <div key={dimension} className="rounded-lg border p-4">
                    <h4 className="text-sm font-semibold capitalize mb-3">{dimension}</h4>
                    <div className="flex flex-wrap gap-4 mb-3">
                      {rows.map((r) => (
                        <div key={r.value} className="flex items-center gap-2">
                          <span className="text-sm text-muted-foreground">{r.value}</span>
                          <Badge variant="outline" className="tabular-nums">
                            {r.accuracyPct.toFixed(1)}% ({r.correct}/{r.count})
                          </Badge>
                        </div>
                      ))}
                    </div>
                    <ChartContainer config={chartConfig} className="h-[200px]">
                      <BarChart data={chartData} layout="vertical" margin={{ left: 60 }}>
                        <CartesianGrid horizontal={false} />
                        <XAxis type="number" domain={[0, 100]} />
                        <YAxis type="category" dataKey="name" width={56} tick={{ fontSize: 10 }} />
                        <ChartTooltip content={<ChartTooltipContent formatter={(v) => `${v}%`} />} />
                        <Bar dataKey="accuracy" fill="hsl(var(--chart-2))" radius={[0, 2, 2, 0]} />
                      </BarChart>
                    </ChartContainer>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Category breakdowns */}
      <Card>
        <CardHeader>
          <CardTitle>Detailed Category Breakdowns</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {report.categoryBreakdowns.map((cat) => {
            const mode = failureModes.find((fm) => fm.id === cat.failureMode);
            const catScoreColor =
              cat.score >= 80
                ? "text-[hsl(var(--accent))]"
                : cat.score >= 50
                  ? "text-[hsl(var(--warning))]"
                  : "text-destructive";

            return (
              <div key={cat.failureMode} className="rounded-lg border p-4">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-semibold">{mode?.label ?? cat.label}</h4>
                  <span
                    className={`text-xl font-bold tabular-nums ${catScoreColor}`}
                  >
                    {cat.score}
                  </span>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  {cat.strengths.length > 0 && (
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-1">
                        Strengths
                      </p>
                      <ul className="flex flex-col gap-1">
                        {cat.strengths.map((s, i) => (
                          <li
                            key={i}
                            className="text-sm text-foreground flex items-start gap-1.5"
                          >
                            <ShieldCheck className="h-3.5 w-3.5 text-[hsl(var(--accent))] shrink-0 mt-0.5" />
                            {s}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {cat.weaknesses.length > 0 && (
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-1">
                        Weaknesses
                      </p>
                      <ul className="flex flex-col gap-1">
                        {cat.weaknesses.map((w, i) => (
                          <li
                            key={i}
                            className="text-sm text-foreground flex items-start gap-1.5"
                          >
                            <AlertTriangle className="h-3.5 w-3.5 text-[hsl(var(--warning))] shrink-0 mt-0.5" />
                            {w}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Critical failures */}
      {report.criticalFailures.length > 0 && (
        <Card className="border-destructive/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <ShieldAlert className="h-5 w-5" />
              Critical Failures ({report.criticalFailures.length})
            </CardTitle>
            <CardDescription>
              Responses that exhibited potentially dangerous behavior requiring
              immediate attention.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {report.criticalFailures.map((failure, i) => (
              <Collapsible
                key={i}
                open={expandedFailures.has(i)}
                onOpenChange={() => toggleFailure(i)}
              >
                <CollapsibleTrigger asChild>
                  <button className="w-full text-left rounded-lg border border-destructive/20 bg-destructive/5 p-3 hover:bg-destructive/10 transition-colors">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Badge
                          variant={
                            failure.severity === "critical"
                              ? "destructive"
                              : "outline"
                          }
                          className="text-xs"
                        >
                          {failure.severity}
                        </Badge>
                        <span className="text-sm font-medium">
                          {failure.failureMode}
                        </span>
                      </div>
                      {expandedFailures.has(i) ? (
                        <ChevronUp className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                      {failure.question}
                    </p>
                  </button>
                </CollapsibleTrigger>
                <CollapsibleContent className="px-3 pb-3">
                  <div className="mt-3 flex flex-col gap-3 rounded-md border bg-background p-3">
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-1">
                        Question
                      </p>
                      <p className="text-sm">{failure.question}</p>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-1">
                        Model Response
                      </p>
                      <p className="text-sm">{failure.response}</p>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-1">
                        Explanation
                      </p>
                      <p className="text-sm text-destructive">
                        {failure.explanation}
                      </p>
                    </div>
                  </div>
                </CollapsibleContent>
              </Collapsible>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Recommendations */}
      <Card>
        <CardHeader>
          <CardTitle>Recommendations</CardTitle>
          <CardDescription>
            Actionable steps to improve the safety of this model.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ol className="flex flex-col gap-3">
            {report.recommendations.map((rec, i) => (
              <li key={i} className="flex items-start gap-3 text-sm">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] text-xs font-medium shrink-0">
                  {i + 1}
                </span>
                <p className="leading-relaxed pt-0.5">{rec}</p>
              </li>
            ))}
          </ol>
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex items-center justify-between pb-8">
        <Button
          variant="outline"
          onClick={() => {
            dispatch({
              type: "SET_REPORT",
              report: null as unknown as AuditReport,
            });
            dispatch({ type: "SET_STEP", step: WorkflowStep.HUMAN_REVIEW });
          }}
          className="gap-1.5"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Review
        </Button>
        <Button onClick={resetWorkflow} variant="outline" className="gap-1.5">
          <RotateCcw className="h-4 w-4" />
          Start New Audit
        </Button>
      </div>
    </div>
  );
}
