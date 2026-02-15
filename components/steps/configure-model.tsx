"use client";

import { useState } from "react";
import { useWorkflow } from "@/lib/workflow-context";
import {
  WorkflowStep,
  PROVIDER_LABELS,
  PROVIDER_DEFAULT_MODELS,
  type Provider,
  type ModelConfig,
  CategoryClassification,
} from "@/lib/types";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AlertCircle, ArrowRight, Loader2, Shield } from "lucide-react";
import { DEFAULT_DESCRIPTION } from "@/lib/consts";

export function ConfigureModel() {
  const { state, dispatch } = useWorkflow();

  const [config, setConfig] = useState<ModelConfig>(
    state.modelConfig ?? {
      provider: "openai",
      apiKey: "",
      modelId: PROVIDER_DEFAULT_MODELS["openai"],
      description: "",
    },
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);

  function handleProviderChange(provider: Provider) {
    setConfig((prev) => ({
      ...prev,
      provider,
      modelId: PROVIDER_DEFAULT_MODELS[provider],
    }));
  }

  function validate(): boolean {
    const newErrors: Record<string, string> = {};
    if (!config.description.trim()) {
      newErrors.description = "Please describe the healthcare use case";
    }
    if (config.description.trim().length < 20) {
      newErrors.description =
        "Please provide a more detailed description (at least 20 characters)";
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  async function handleContinue() {
    if (!validate()) return;

    setIsLoading(true);
    try {
      dispatch({ type: "SET_MODEL_CONFIG", config });
      const res = await fetch("/api/classify-category", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description: config.description }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Classification failed");

      const result: CategoryClassification = json.data;
      dispatch({ type: "SET_CATEGORY_CLASSIFICATION", classification: result });
    } catch (err) {
      setErrors({
        classifiction:
          err instanceof Error ? err.message : "Classification failed",
      });
      setIsLoading(false);
      return;
    }

    setIsLoading(false);
    dispatch({ type: "SET_STEP", step: WorkflowStep.GENERATE });
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight text-balance">
          Configure Target Model
        </h2>
        <p className="text-muted-foreground mt-1">
          Set up the AI model you want to evaluate for healthcare safety
          compliance.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-[hsl(var(--primary))]" />
            Model Connection
          </CardTitle>
          <CardDescription>
            Select the provider and model you want to test. The model will be
            probed with safety-critical healthcare scenarios.
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
                  {(
                    Object.entries(PROVIDER_LABELS) as [Provider, string][]
                  ).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
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
            <Label htmlFor="apiKey">
              API Key (optional for supported providers)
            </Label>
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
              Leave empty if using Vercel AI Gateway-supported providers
              (OpenAI, Anthropic, etc.)
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Healthcare Use Case</CardTitle>
          <CardDescription>
            Describe what the AI model is used for. This determines which
            failure mode category and test scenarios are selected.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <Textarea
            id="description"
            value={config.description}
            onChange={(e) => {
              setConfig((prev) => ({ ...prev, description: e.target.value }));
            }}
            placeholder={`e.g. ${DEFAULT_DESCRIPTION}`}
            rows={4}
            className="resize-none"
          />
          <div>
            <button
              onClick={() => {
                setConfig((prev) => ({
                  ...prev,
                  description: DEFAULT_DESCRIPTION,
                }));
              }}
            >
              <div className="text-muted-foreground underline text-sm">
                Autofill
              </div>
            </button>
          </div>
          {errors.description && (
            <p className="text-sm text-destructive flex items-center gap-1.5">
              <AlertCircle className="h-3.5 w-3.5" />
              {errors.description}
            </p>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-end gap-3">
        {errors.classification && (
          <p className="text-sm text-destructive flex items-center gap-1.5">
            <AlertCircle className="h-3.5 w-3.5" />
            {errors.classification}
          </p>
        )}
        {isLoading}
        <Button
          onClick={handleContinue}
          size="lg"
          className="gap-2"
          disabled={isLoading}
        >
          Generate Test Questions
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin text-white" />
          ) : (
            <ArrowRight className="h-4 w-4" />
          )}
        </Button>
      </div>
    </div>
  );
}
