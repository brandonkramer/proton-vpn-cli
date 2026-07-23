import { Box, Text, useApp } from "ink";
import { Alert, Spinner, StatusMessage } from "@inkjs/ui";
import { useEffect, useState, type ReactNode } from "react";
import { isQuietUi } from "../util/agent.ts";
import { Brand } from "./brand.tsx";
import { renderUntilExit } from "./render.tsx";

export type StepStatus = "pending" | "running" | "done" | "error" | "skipped";

export interface TaskStep {
  id: string;
  label: string;
  status: StepStatus;
  detail?: string;
}

export interface TaskController {
  setSteps: (steps: TaskStep[]) => void;
  updateStep: (
    id: string,
    patch: Partial<Pick<TaskStep, "status" | "detail" | "label">>,
  ) => void;
  setNote: (note: string | null) => void;
  setResult: (
    result: { variant: "success" | "error" | "info" | "warning"; title: string; body?: string } | null,
  ) => void;
  done: () => void;
}

function StepRow({ step }: { step: TaskStep }): ReactNode {
  if (step.status === "running") {
    return (
      <Box>
        <Spinner label={step.label} />
        {step.detail ? <Text dimColor> — {step.detail}</Text> : null}
      </Box>
    );
  }

  if (step.status === "done") {
    return (
      <StatusMessage variant="success">
        {step.label}
        {step.detail ? ` — ${step.detail}` : ""}
      </StatusMessage>
    );
  }

  if (step.status === "error") {
    return (
      <StatusMessage variant="error">
        {step.label}
        {step.detail ? ` — ${step.detail}` : ""}
      </StatusMessage>
    );
  }

  if (step.status === "skipped") {
    return (
      <StatusMessage variant="warning">
        {step.label}
        {step.detail ? ` — ${step.detail}` : ""}
      </StatusMessage>
    );
  }

  return (
    <Box>
      <Text dimColor>○ {step.label}</Text>
    </Box>
  );
}

function TaskApp({
  title,
  initialSteps,
  note: initialNote,
  onReady,
}: {
  title: string;
  initialSteps: TaskStep[];
  note?: string | null;
  onReady: (controller: TaskController) => void;
}): ReactNode {
  const { exit } = useApp();
  const [steps, setSteps] = useState(initialSteps);
  const [note, setNote] = useState<string | null>(initialNote ?? null);
  const [result, setResult] = useState<{
    variant: "success" | "error" | "info" | "warning";
    title: string;
    body?: string;
  } | null>(null);

  useEffect(() => {
    const controller: TaskController = {
      setSteps,
      updateStep: (id, patch) => {
        setSteps((current) =>
          current.map((step) => (step.id === id ? { ...step, ...patch } : step)),
        );
      },
      setNote,
      setResult,
      done: () => exit(),
    };
    onReady(controller);
  }, []);

  return (
    <Box flexDirection="column">
      <Brand subtitle={title} />
      <Box flexDirection="column" marginBottom={1}>
        {steps.map((step) => (
          <StepRow key={step.id} step={step} />
        ))}
      </Box>
      {note ? (
        <Box marginBottom={1}>
          <Text dimColor>{note}</Text>
        </Box>
      ) : null}
      {result ? (
        <Alert variant={result.variant} title={result.title}>
          {result.body ?? ""}
        </Alert>
      ) : null}
    </Box>
  );
}

function quietController(): TaskController {
  return {
    setSteps: () => undefined,
    updateStep: () => undefined,
    setNote: () => undefined,
    setResult: () => undefined,
    done: () => undefined,
  };
}

export async function runTask<T>(options: {
  title: string;
  steps: Array<{ id: string; label: string }>;
  note?: string;
  run: (ui: TaskController) => Promise<T>;
}): Promise<T> {
  if (isQuietUi()) {
    return options.run(quietController());
  }

  let controller!: TaskController;
  let ready!: () => void;
  const waitReady = new Promise<void>((resolve) => {
    ready = resolve;
  });

  const initialSteps: TaskStep[] = options.steps.map((step) => ({
    ...step,
    status: "pending" as const,
  }));

  const renderPromise = renderUntilExit(
    <TaskApp
      title={options.title}
      initialSteps={initialSteps}
      note={options.note}
      onReady={(c) => {
        controller = c;
        ready();
      }}
    />,
  );

  await waitReady;

  try {
    const value = await options.run(controller);
    // Brief pause so the final success state is visible.
    await Bun.sleep(40);
    controller.done();
    await renderPromise;
    return value;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    controller.setResult({
      variant: "error",
      title: "Failed",
      body: message,
    });
    await Bun.sleep(80);
    controller.done();
    await renderPromise;
    throw error;
  }
}

