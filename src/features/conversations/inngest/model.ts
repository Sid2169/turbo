import { gemini, type Agent, type StateData } from "@inngest/agent-kit";
import { NonRetriableError } from "inngest";
import { isDeepStrictEqual } from "node:util";

export function createConversationModel(purpose: "title" | "coding") {
  const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  if (!apiKey) {
    throw new NonRetriableError("GOOGLE_GENERATIVE_AI_API_KEY is not configured");
  }
  const thinkingConfig = {
    includeThoughts: false,
    thinkingLevel: purpose === "title" ? "minimal" : "low",
  };

  return gemini({
    apiKey,
    model: "gemini-3.6-flash",
    defaultParameters: {
      generationConfig: {
        temperature: purpose === "title" ? 0 : 0.3,
        maxOutputTokens: purpose === "title" ? 128 : 16000,
        thinkingConfig,
      },
    },
  });
}

type GeminiPart = {
  text?: string;
  functionCall?: { name: string; args?: unknown; id?: string };
  functionResponse?: { name: string; response: unknown; id?: string };
  [key: string]: unknown;
};
type GeminiContent = { role: string; parts: GeminiPart[] };

// AgentKit 0.13 converts Gemini responses to generic messages, losing signed
// parts. Restore the original parts on replay, including after an Inngest step
// resumes. Never fabricate or bypass Google's thought signatures.
export function restoreGeminiHistory(
  contents: GeminiContent[],
  rawResponses: string[],
) {
  const originalParts = rawResponses.flatMap((raw) => {
    const response = JSON.parse(raw) as { candidates?: { content?: GeminiContent }[] };
    return response.candidates?.flatMap((candidate) => candidate.content?.parts ?? []) ?? [];
  });
  let nextPart = 0;
  const pendingCalls: NonNullable<GeminiPart["functionCall"]>[] = [];
  const restored: GeminiContent[] = [];
  for (const content of contents) {
    const parts = content.parts.map((part) => {
      if (part.functionResponse) {
        const index = pendingCalls.findIndex((call) => call.name === part.functionResponse?.name);
        if (index !== -1) {
          const [call] = pendingCalls.splice(index, 1);
          if (call.id) return { ...part, functionResponse: { ...part.functionResponse, id: call.id } };
        }
        return part;
      }
      const original = originalParts[nextPart];
      if (content.role !== "model" || !original) return part;
      const matches = part.functionCall
        ? part.functionCall.name === original.functionCall?.name &&
          isDeepStrictEqual(part.functionCall.args ?? {}, original.functionCall?.args ?? {})
        : part.text !== undefined && part.text === original.text;
      if (!matches) return part;
      nextPart++;
      if (original.functionCall) pendingCalls.push(original.functionCall);
      return original;
    });
    // AgentKit splits each model part into a separate message. Gemini expects
    // parallel function calls and their signatures within the original turn.
    const previous = restored.at(-1);
    if (content.role === "model" && previous?.role === "model") {
      previous.parts.push(...parts);
    } else {
      restored.push({ ...content, parts: [...parts] });
    }
  }
  return restored;
}

export function createConversationAgentConfig(purpose: "title" | "coding") {
  const model = createConversationModel(purpose);
  const originalOnCall = model.onCall;
  let rawResponses: string[] = [];
  model.onCall = (adapter, body) => {
    originalOnCall?.(adapter, body);
    const request = body as unknown as { contents: GeminiContent[] };
    request.contents = restoreGeminiHistory(request.contents, rawResponses);
  };
  const lifecycle: Agent.Lifecycle<StateData> = {
    onStart: ({ prompt, history, network }) => {
      rawResponses = network?.state.results.flatMap((result) => result.raw ? [result.raw] : []) ?? [];
      return { prompt, history: history ?? [], stop: false };
    },
  };
  return { model, lifecycle };
}

// Classify errors without exposing provider responses, credentials, or prompts.
export function getMessageFailureContent(message: string) {
  if (message.includes("GOOGLE_GENERATIVE_AI_API_KEY is not configured")) {
    return "Website generation could not start: the Google AI API key is missing. Configure GOOGLE_GENERATIVE_AI_API_KEY on the app server, restart it, and send your request again.";
  }
  if (/429|RESOURCE_EXHAUSTED|quota|rate.limit/i.test(message)) {
    return "Website generation stopped because Google AI's quota or rate limit was reached. Check your Google AI quota and billing, then try again when requests are available.";
  }
  if (/401|403|API_KEY_INVALID|API key not valid|unauthenticated|permission.denied/i.test(message)) {
    return "Website generation stopped because Google AI rejected the credentials or access. Check the app server's Google AI API key and model access, then try again.";
  }
  if (/404|NOT_FOUND|model.*not.*(found|supported|available)/i.test(message)) {
    return "Website generation stopped because the configured AI model is unavailable. Check the model configuration and your Google AI access before retrying.";
  }
  return "Website generation failed. Check the failed process-message run in Inngest for details, then send your request again. Any files already created are still in your project.";
}
