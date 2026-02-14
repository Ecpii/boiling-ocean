"use client"

import { useEffect, useRef, useState } from "react"
import { useWorkflow } from "@/lib/workflow-context"
import { WorkflowStep, FAILURE_MODES, type AuditReport } from "@/lib/types"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
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
} from "recharts"
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
} from "lucide-react"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"

const chartConfig: ChartConfig = {
  score: {
    label: "Score",
    color: "hsl(var(--chart-1))",
  },
}

export function FinalReport() {
  const { state, dispatch, resetWorkflow } = useWorkflow()
  const hasStarted = useRef(false)
  const [expandedFailures, setExpandedFailures] = useState<Set<number>>(new Set())

  useEffect(() => {
    if (hasStarted.current) return
    if (state.report) return

    hasStarted.current = true
    generateReport()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function generateReport() {
    dispatch({ type: "SET_LOADING", loading: true })
    dispatch({ type: "SET_ERROR", error: null })

    try {
      const res = await fetch("/api/evaluate-responses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          responses: state.responses,
          humanReviews: state.humanReviews,
          description: state.modelConfig!.description,
        }),
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || "Failed to generate report")
      }

      const { data } = await res.json()
      dispatch({ type: "SET_REPORT", report: data as AuditReport })
      dispatch({ type: "SET_LOADING", loading: false })
    } catch (error) {
      dispatch({
        type: "SET_ERROR",
        error: error instanceof Error ? error.message : "Failed to generate report",
      })
    }
  }

  function toggleFailure(index: number) {
    setExpandedFailures((prev) => {
      const next = new Set(prev)
      if (next.has(index)) {
        next.delete(index)
      } else {
        next.add(index)
      }
      return next
    })
  }

  function exportReport() {
    if (!state.report) return
    const blob = new Blob([JSON.stringify(state.report, null, 2)], {
      type: "application/json",
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `safety-audit-report-${new Date().toISOString().slice(0, 10)}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  // Loading state
  if (state.isLoading) {
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
                Claude is analyzing all responses and human feedback to produce your safety report...
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Error state
  if (state.error) {
    return (
      <div className="flex flex-col items-center gap-6 py-12">
        <Card className="w-full max-w-lg">
          <CardContent className="flex flex-col items-center gap-4 py-10">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10">
              <AlertTriangle className="h-7 w-7 text-destructive" />
            </div>
            <div className="text-center">
              <h3 className="text-lg font-semibold">Report Generation Failed</h3>
              <p className="text-sm text-destructive mt-1">{state.error}</p>
            </div>
            <Button
              onClick={() => {
                hasStarted.current = false
                generateReport()
              }}
              variant="outline"
            >
              Retry
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!state.report) return null

  const report = state.report

  const scoreColor =
    report.overallSafetyScore >= 80
      ? "text-[hsl(var(--accent))]"
      : report.overallSafetyScore >= 50
        ? "text-[hsl(var(--warning))]"
        : "text-destructive"

  const scoreBg =
    report.overallSafetyScore >= 80
      ? "bg-[hsl(var(--accent))]/10"
      : report.overallSafetyScore >= 50
        ? "bg-[hsl(var(--warning))]/10"
        : "bg-destructive/10"

  const ScoreIcon = report.overallSafetyScore >= 80 ? ShieldCheck : ShieldAlert

  // Chart data
  const barData = report.categoryBreakdowns.map((cat) => {
    const mode = FAILURE_MODES.find((fm) => fm.id === cat.failureMode)
    return {
      name: mode?.label ?? cat.label,
      score: cat.score,
      fill:
        cat.score >= 80
          ? "hsl(var(--chart-2))"
          : cat.score >= 50
            ? "hsl(var(--chart-4))"
            : "hsl(var(--chart-3))",
    }
  })

  const radarData = report.categoryBreakdowns.map((cat) => {
    const mode = FAILURE_MODES.find((fm) => fm.id === cat.failureMode)
    return {
      category: mode?.label ?? cat.label,
      score: cat.score,
    }
  })

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight text-balance">
            Safety Audit Report
          </h2>
          <p className="text-muted-foreground mt-1">
            Comprehensive evaluation of {state.modelConfig?.modelId} ({state.modelConfig?.provider})
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={exportReport} className="gap-1.5">
            <Download className="h-3.5 w-3.5" />
            Export
          </Button>
        </div>
      </div>

      {/* Overall score */}
      <Card>
        <CardContent className="flex items-center gap-6 py-6">
          <div className={`flex h-20 w-20 items-center justify-center rounded-2xl ${scoreBg} shrink-0`}>
            <ScoreIcon className={`h-10 w-10 ${scoreColor}`} />
          </div>
          <div className="flex-1">
            <div className="flex items-baseline gap-2">
              <span className={`text-4xl font-bold tabular-nums ${scoreColor}`}>
                {report.overallSafetyScore}
              </span>
              <span className="text-lg text-muted-foreground">/ 100</span>
            </div>
            <p className="text-sm text-muted-foreground mt-1">Overall Safety Score</p>
          </div>
          <div className="hidden sm:flex items-center gap-4 text-sm">
            <div className="text-center">
              <p className="font-semibold tabular-nums">{report.criticalFailures.length}</p>
              <p className="text-muted-foreground">Critical Issues</p>
            </div>
            <div className="h-8 w-px bg-border" />
            <div className="text-center">
              <p className="font-semibold tabular-nums">{report.humanAgreementRate}%</p>
              <p className="text-muted-foreground">Human Agreement</p>
            </div>
            <div className="h-8 w-px bg-border" />
            <div className="text-center">
              <p className="font-semibold tabular-nums">{state.responses.length}</p>
              <p className="text-muted-foreground">Tests Run</p>
            </div>
          </div>
        </CardContent>
      </Card>

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
            <CardDescription>Safety score by failure mode (0-100)</CardDescription>
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

      {/* Category breakdowns */}
      <Card>
        <CardHeader>
          <CardTitle>Detailed Category Breakdowns</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {report.categoryBreakdowns.map((cat) => {
            const mode = FAILURE_MODES.find((fm) => fm.id === cat.failureMode)
            const catScoreColor =
              cat.score >= 80
                ? "text-[hsl(var(--accent))]"
                : cat.score >= 50
                  ? "text-[hsl(var(--warning))]"
                  : "text-destructive"

            return (
              <div key={cat.failureMode} className="rounded-lg border p-4">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-semibold">{mode?.label ?? cat.label}</h4>
                  <span className={`text-xl font-bold tabular-nums ${catScoreColor}`}>
                    {cat.score}
                  </span>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  {cat.strengths.length > 0 && (
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-1">Strengths</p>
                      <ul className="flex flex-col gap-1">
                        {cat.strengths.map((s, i) => (
                          <li key={i} className="text-sm text-foreground flex items-start gap-1.5">
                            <ShieldCheck className="h-3.5 w-3.5 text-[hsl(var(--accent))] shrink-0 mt-0.5" />
                            {s}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {cat.weaknesses.length > 0 && (
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-1">Weaknesses</p>
                      <ul className="flex flex-col gap-1">
                        {cat.weaknesses.map((w, i) => (
                          <li key={i} className="text-sm text-foreground flex items-start gap-1.5">
                            <AlertTriangle className="h-3.5 w-3.5 text-[hsl(var(--warning))] shrink-0 mt-0.5" />
                            {w}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            )
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
              Responses that exhibited potentially dangerous behavior requiring immediate attention.
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
                          variant={failure.severity === "critical" ? "destructive" : "outline"}
                          className="text-xs"
                        >
                          {failure.severity}
                        </Badge>
                        <span className="text-sm font-medium">{failure.failureMode}</span>
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
                      <p className="text-xs font-medium text-muted-foreground mb-1">Question</p>
                      <p className="text-sm">{failure.question}</p>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-1">Model Response</p>
                      <p className="text-sm">{failure.response}</p>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-1">Explanation</p>
                      <p className="text-sm text-destructive">{failure.explanation}</p>
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
            dispatch({ type: "SET_REPORT", report: null as unknown as AuditReport })
            dispatch({ type: "SET_STEP", step: WorkflowStep.HUMAN_REVIEW })
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
  )
}
