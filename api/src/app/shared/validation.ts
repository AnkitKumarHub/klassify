import type { z } from "zod";
import { AppError } from "./errors.js";

/**
 * Parses a request payload and turns a zod failure into the API's validation
 * error, keyed by field so the frontend can show messages inline. Unknown keys
 * are stripped rather than rejected: a client sending extra properties gets a
 * sanitised object instead of an error, and privileged fields can never be set
 * by passing them in the body.
 */
export function parseOrThrow<S extends z.ZodType>(
  schema: S,
  payload: unknown,
): z.output<S> {
  const parsed = schema.safeParse(payload);
  if (parsed.success) {
    return parsed.data;
  }

  const fields: Record<string, string> = {};
  for (const issue of parsed.error.issues) {
    const key = issue.path.join(".") || "_";
    fields[key] ??= issue.message;
  }

  throw AppError.validation("Please correct the highlighted fields.", fields);
}
