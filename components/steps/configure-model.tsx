"use client"

import { useState } from "react"
import { useWorkflow } from "@/lib/workflow-context"
import {
  WorkflowStep,
  PROVIDER_LABELS,
  PROVIDER_DEFAULT_MODELS,
  type Provider,
  type ModelConfig,
} from "@/lib/types"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { AlertCircle, ArrowRight, Shield } from "lucide-react"

export function ConfigureModel() {
  const { state, dispatch } = useWorkflow()

  const [config, setConfig] = useState<ModelConfig>(
    state.modelConfig ?? {
      provider: "openai",
      apiKey: "",
      modelId: PROVIDER_DEFAULT_MODELS["openai"],
      description: "",
    }
  )
  const [errors, setErrors] = useState<Record<string, string>>({})

  function handleProviderChange(provider: Provider) {
    setConfig((prev) => ({
      ...prev,
      provider,
      modelId: PROVIDER_DEFAULT_MODELS[provider],
    }))
  }

  function validate(): boolean {
    const newErrors: Record<string, string> = {}
    if (!config.description.trim()) {
      newErrors.description = "Please describe the healthcare use case"
    }
    if (config.description.trim().length < 20) {
      newErrors.description = "Please provide a more detailed description (at least 20 characters)"
    }
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  function handleSubmit() {
    if (!validate()) return
    dispatch({ type: "SET_MODEL_CONFIG", config })
    dispatch({ type: "SET_STEP", step: WorkflowStep.GENERATE })
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight text-balance">Configure Target Model</h2>
        <p className="text-muted-foreground mt-1">
          Set up the AI model you want to evaluate for healthcare safety compliance.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-[hsl(var(--primary))]" />
            Model Connection
          </CardTitle>
          <CardDescription>
            Select the provider and model you want to test. The model will be probed with safety-critical healthcare scenarios.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          <div className="grid gap-5 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="provider">Provider</Label>
              <Select
                value={config.provider}
                onValueChange={(v) => handleProviderChange(v as Provider)}
              >
                <SelectTrigger id="provider">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.entries(PROVIDER_LABELS) as [Provider, string][]).map(
                    ([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    )
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="modelId">Model ID</Label>
              <Input
                id="modelId"
                value={config.modelId}
                onChange={(e) =>
                  setConfig((prev) => ({ ...prev, modelId: e.target.value }))
                }
                placeholder="e.g. gpt-4o"
              />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="apiKey">API Key (optional for supported providers)</Label>
            <Input
              id="apiKey"
              type="password"
              value={config.apiKey}
              onChange={(e) =>
                setConfig((prev) => ({ ...prev, apiKey: e.target.value }))
              }
              placeholder="sk-..."
            />
            <p className="text-xs text-muted-foreground">
              Leave empty if using Vercel AI Gateway-supported providers (OpenAI, Anthropic, etc.)
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Healthcare Use Case</CardTitle>
          <CardDescription>
            Describe what the AI model is used for. This helps generate relevant test scenarios.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <Textarea
            id="description"
            value={config.description}
            onChange={(e) =>
              setConfig((prev) => ({ ...prev, description: e.target.value }))
            }
            placeholder="e.g. A patient-facing chatbot that helps users understand their medications, provides general health information, and assists with appointment scheduling for a large hospital network."
            rows={4}
            className="resize-none"
          />
          {errors.description && (
            <p className="text-sm text-destructive flex items-center gap-1.5">
              <AlertCircle className="h-3.5 w-3.5" />
              {errors.description}
            </p>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSubmit} size="lg" className="gap-2">
          Generate Test Questions
          <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}
