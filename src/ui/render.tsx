import { render } from "ink";
import type { ReactNode } from "react";

/** Render an Ink tree and wait until it unmounts. */
export async function renderUntilExit(node: ReactNode): Promise<void> {
  const instance = render(node);
  await instance.waitUntilExit();
}

/**
 * Render an Ink app that resolves a value, then unmounts.
 * The app must call `onDone` / `onError` exactly once.
 */
export async function renderPrompt<T>(
  factory: (handlers: {
    resolve: (value: T) => void;
    reject: (error: Error) => void;
  }) => ReactNode,
): Promise<T> {
  let settle: ((value: T) => void) | undefined;
  let fail: ((error: Error) => void) | undefined;
  const result = new Promise<T>((resolve, reject) => {
    settle = resolve;
    fail = reject;
  });

  const instance = render(
    factory({
      resolve: (value) => {
        settle?.(value);
        instance.unmount();
      },
      reject: (error) => {
        fail?.(error);
        instance.unmount();
      },
    }),
  );

  try {
    return await result;
  } finally {
    instance.unmount();
  }
}
