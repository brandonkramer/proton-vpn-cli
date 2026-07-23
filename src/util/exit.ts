/** Process exit codes for scripting / agents. */
export const ExitCode = {
  OK: 0,
  ERROR: 1,
  USAGE: 2,
  NOT_SIGNED_IN: 3,
  PRIVILEGE: 4,
} as const;

export type ExitCodeValue = (typeof ExitCode)[keyof typeof ExitCode];
