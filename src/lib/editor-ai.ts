import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { APICallError, generateText, Output } from "ai";
import { z } from "zod";

export async function generateEditorResult<T extends z.ZodType>({
  schema, prompt, purpose, signal,
}: {
  schema: T;
  prompt: string;
  purpose: "suggestion" | "edit";
  signal?: AbortSignal;
}) {
  const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  if (!apiKey) throw new Error("GOOGLE_GENERATIVE_AI_API_KEY is not configured");
  const google = createGoogleGenerativeAI({ apiKey });
  const deadline = AbortSignal.timeout(purpose === "suggestion" ? 8000 : 25000);
  const { output } = await generateText({
    model: google(purpose === "suggestion" ? "gemini-3.5-flash-lite" : "gemini-3.6-flash"),
    output: Output.object({ schema }),
    prompt,
    maxOutputTokens: purpose === "suggestion" ? 512 : 8192,
    maxRetries: 0,
    abortSignal: signal ? AbortSignal.any([signal, deadline]) : deadline,
    providerOptions: { google: { thinkingConfig: { thinkingLevel: "minimal" } } },
  });
  return schema.parse(output) as z.output<T>;
}

export function getEditorError(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  if (message.includes("GOOGLE_GENERATIVE_AI_API_KEY is not configured")) {
    return { status: 503, error: "Configure the Google AI API key on the app server." };
  }
  if (APICallError.isInstance(error)) {
    if (error.statusCode === 429) {
      return { status: 429, error: "Google AI quota or rate limit reached. Try again later." };
    }
    if (/API key not valid|API_KEY_INVALID/i.test(message) || error.statusCode === 401 || error.statusCode === 403) {
      return { status: 503, error: "Google AI rejected the app's API key or access." };
    }
    if (error.statusCode === 404) {
      return { status: 503, error: "The configured Google AI model is unavailable." };
    }
  }
  if (error instanceof Error && /TimeoutError|AbortError/.test(error.name)) {
    return { status: 504, error: "Google AI took too long to respond. Please try again." };
  }
  return { status: 502, error: "Google AI could not complete this request. Please try again." };
}
