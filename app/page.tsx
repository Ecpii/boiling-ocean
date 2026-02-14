"use client"

import { WorkflowProvider, useWorkflow } from "@/lib/workflow-context"
import { WorkflowStep } from "@/lib/types"
import { WorkflowStepper } from "@/components/workflow-stepper"
import { ConfigureModel } from "@/components/steps/configure-model"
import { GenerateQuestions } from "@/components/steps/generate-questions"
import { ReviewQuestions } from "@/components/steps/review-questions"
import { CollectResponses } from "@/components/steps/collect-responses"
import { HumanReviewStep } from "@/components/steps/human-review"
import { FinalReport } from "@/components/steps/final-report"
import { Button } from "@/components/ui/button"
import { RotateCcw, ShieldCheck } from "lucide-react"

function WorkflowContent() {
  const { state, resetWorkflow } = useWorkflow()

  const stepComponents: Record<WorkflowStep, React.ReactNode> = {
    [WorkflowStep.CONFIGURE]: <ConfigureModel />,
    [WorkflowStep.GENERATE]: <GenerateQuestions />,
    [WorkflowStep.REVIEW]: <ReviewQuestions />,
    [WorkflowStep.COLLECT]: <CollectResponses />,
    [WorkflowStep.HUMAN_REVIEW]: <HumanReviewStep />,
    [WorkflowStep.REPORT]: <FinalReport />,
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4 sm:px-6">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]">
              <ShieldCheck className="h-4.5 w-4.5" />
            </div>
            <div>
              <h1 className="text-base font-semibold leading-none tracking-tight">
                AI Safety Validator
              </h1>
              <p className="text-xs text-muted-foreground mt-0.5">Healthcare Model Audit</p>
            </div>
          </div>
          {state.step > WorkflowStep.CONFIGURE && (
            <Button variant="ghost" size="sm" onClick={resetWorkflow} className="gap-1.5 text-muted-foreground">
              <RotateCcw className="h-3.5 w-3.5" />
              Reset
            </Button>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-8">
        <div className="mb-8">
          <WorkflowStepper />
        </div>
        {stepComponents[state.step]}
      </main>
    </div>
  )
}

export default function Page() {
  return (
    <WorkflowProvider>
      <WorkflowContent />
    </WorkflowProvider>
  )
}
