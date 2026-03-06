import { afterEach, beforeEach, vi } from "vitest";

type AllowedPattern = RegExp | string;

const allowedPatterns: AllowedPattern[] = [];
let unexpectedMessages: string[] = [];
let warnSpy: ReturnType<typeof vi.spyOn> | null = null;
let errorSpy: ReturnType<typeof vi.spyOn> | null = null;

function stringifyArg(value: unknown): string {
  if (value instanceof Error) {
    return value.stack || value.message;
  }
  if (typeof value === "string") {
    return value;
  }
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function isAllowed(message: string): boolean {
  return allowedPatterns.some((pattern) =>
    typeof pattern === "string" ? message.includes(pattern) : pattern.test(message),
  );
}

function recordUnexpected(kind: "warn" | "error", args: unknown[]) {
  const message = args.map(stringifyArg).join(" ").trim();
  if (!message || isAllowed(message)) return;
  unexpectedMessages.push(`console.${kind}: ${message}`);
}

export function allowConsole(...patterns: AllowedPattern[]) {
  allowedPatterns.push(...patterns);
}

beforeEach(() => {
  unexpectedMessages = [];
  allowedPatterns.length = 0;

  warnSpy = vi.spyOn(console, "warn").mockImplementation((...args: unknown[]) => {
    recordUnexpected("warn", args);
  });

  errorSpy = vi.spyOn(console, "error").mockImplementation((...args: unknown[]) => {
    recordUnexpected("error", args);
  });
});

afterEach(() => {
  warnSpy?.mockRestore();
  errorSpy?.mockRestore();
  warnSpy = null;
  errorSpy = null;

  const messages = [...new Set(unexpectedMessages)];
  unexpectedMessages = [];
  allowedPatterns.length = 0;

  if (messages.length > 0) {
    throw new Error(`Unexpected console output:\n${messages.join("\n")}`);
  }
});
