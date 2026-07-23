import { Box, Text } from "ink";
import { PasswordInput, TextInput } from "@inkjs/ui";
import type { ReactNode } from "react";
import { Brand } from "./brand.tsx";
import { renderPrompt } from "./render.tsx";

function PromptFrame({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: ReactNode;
}): ReactNode {
  return (
    <Box flexDirection="column">
      <Brand subtitle={title} />
      {hint ? (
        <Box marginBottom={1}>
          <Text dimColor>{hint}</Text>
        </Box>
      ) : null}
      {children}
    </Box>
  );
}

export async function inkPromptText(
  label: string,
  options: { placeholder?: string; defaultValue?: string; hint?: string } = {},
): Promise<string> {
  return renderPrompt<string>(({ resolve, reject }) => (
    <PromptFrame title={label} hint={options.hint}>
      <Box flexDirection="column">
        <Text>
          <Text color="cyan">› </Text>
          {label}
        </Text>
        <TextInput
          placeholder={options.placeholder ?? ""}
          defaultValue={options.defaultValue}
          onSubmit={(value) => {
            const trimmed = value.trim();
            if (!trimmed) {
              reject(new Error(`${label} is required.`));
              return;
            }
            resolve(trimmed);
          }}
        />
      </Box>
    </PromptFrame>
  ));
}

export async function inkPromptPassword(
  label = "Password",
  options: { hint?: string } = {},
): Promise<string> {
  return renderPrompt<string>(({ resolve, reject }) => (
    <PromptFrame title={label} hint={options.hint}>
      <Box flexDirection="column">
        <Text>
          <Text color="cyan">› </Text>
          {label}
        </Text>
        <PasswordInput
          placeholder="••••••••"
          onSubmit={(value) => {
            if (!value) {
              reject(new Error(`${label} is required.`));
              return;
            }
            resolve(value);
          }}
        />
      </Box>
    </PromptFrame>
  ));
}

export async function inkPromptTotp(): Promise<string> {
  return renderPrompt<string>(({ resolve, reject }) => (
    <PromptFrame
      title="Two-factor authentication"
      hint="Enter the 6-digit code from your authenticator app (TOTP only)."
    >
      <Box flexDirection="column">
        <Text>
          <Text color="cyan">› </Text>
          2FA code
        </Text>
        <TextInput
          placeholder="123456"
          onSubmit={(value) => {
            const code = value.trim();
            if (!/^\d+$/.test(code)) {
              reject(
                new Error(
                  "2FA code must be numeric (TOTP only). FIDO2 keys are not supported.",
                ),
              );
              return;
            }
            resolve(code);
          }}
        />
      </Box>
    </PromptFrame>
  ));
}
