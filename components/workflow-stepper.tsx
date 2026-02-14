"use client"

import { useWorkflow } from "@/lib/workflow-context"
import { WorkflowStep, WORKFLOW_STEP_LABELS } from "@/lib/types"
import { cn } from "@/lib/utils"
import {
  Settings,
  Sparkles,
  ClipboardCheck,
  Play,
  UserCheck,
  FileText,
  Check,
} from "lucide-react"

const STEP_ICONS = [Settings, Sparkles, ClipboardCheck, Play, UserCheck, FileText]

export function WorkflowStepper() {
  const { state } = useWorkflow()

  const steps = Object.values(WorkflowStep).filter(
    (v) => typeof v === "number"
  ) as WorkflowStep[]

  return (
    <nav aria-label="Workflow progress" className="w-full">
      <ol className="flex items-center gap-0">
        {steps.map((step, index) => {
          const Icon = STEP_ICONS[index]
          const isCompleted = state.step > step
          const isCurrent = state.step === step
          const isUpcoming = state.step < step

          return (
            <li
              key={step}
              className={cn("flex items-center", index < steps.length - 1 && "flex-1")}
            >
              <div className="flex flex-col items-center gap-1.5">
                <div
                  className={cn(
                    "flex h-9 w-9 items-center justify-center rounded-full border-2 transition-colors",
                    isCompleted &&
                      "border-[hsl(var(--accent))] bg-[hsl(var(--accent))] text-[hsl(var(--accent-foreground))]",
                    isCurrent &&
                      "border-[hsl(var(--primary))] bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]",
                    isUpcoming &&
                      "border-[hsl(var(--border))] bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]"
                  )}
                >
                  {isCompleted ? (
                    <Check className="h-4 w-4" />
                  ) : (
                    <Icon className="h-4 w-4" />
                  )}
                </div>
                <span
                  className={cn(
                    "text-xs font-medium whitespace-nowrap hidden sm:block",
                    isCurrent && "text-foreground",
                    isCompleted && "text-[hsl(var(--accent))]",
                    isUpcoming && "text-muted-foreground"
                  )}
                >
                  {WORKFLOW_STEP_LABELS[step]}
                </span>
              </div>
              {index < steps.length - 1 && (
                <div
                  className={cn(
                    "mx-2 h-0.5 flex-1 rounded-full transition-colors",
                    state.step > step
                      ? "bg-[hsl(var(--accent))]"
                      : "bg-border"
                  )}
                />
              )}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
