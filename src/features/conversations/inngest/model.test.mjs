import assert from "node:assert/strict";
import { test } from "node:test";
import { createAgent, createNetwork, createTool } from "@inngest/agent-kit";
import { z } from "zod";
import { createConversationModel, createConversationAgentConfig, restoreGeminiHistory, getMessageFailureContent } from "./model.ts";

test("missing Google credentials fail before requesting a model", () => {
  const previous = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  delete process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  try {
    assert.throws(() => createConversationModel("coding"), /GOOGLE_GENERATIVE_AI_API_KEY is not configured/);
  } finally {
    if (previous !== undefined) process.env.GOOGLE_GENERATIVE_AI_API_KEY = previous;
  }
});

test("Gemini title and coding requests use the app key and execute a tool round trip", async () => {
  const previous = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  process.env.GOOGLE_GENERATIVE_AI_API_KEY = "test-google-key";
  const originalFetch = globalThis.fetch;
  const requests = [];
  const files = new Map();
  globalThis.fetch = async (url, init) => {
    assert.match(String(url), /generativelanguage.googleapis.com/);
    assert.match(String(url), /gemini-3.6-flash/);
    assert.match(String(url), /test-google-key/);
    const body = JSON.parse(init.body);
    requests.push(body);
    const parts = requests.length === 1
      ? [{ text: "Simple Website" }]
      : requests.length === 2
        ? [{ functionCall: { name: "createFile", args: { name: "index.html", content: "<h1>Hello</h1>" }, id: "google-call-1" }, thoughtSignature: "signed-tool-call" }]
        : [{ text: "Created your website." }];
    return Response.json({ candidates: [{ content: { role: "model", parts }, finishReason: "STOP" }] });
  };
  try {
    const title = await createAgent({ name: "title", system: "Generate a title.", model: createConversationModel("title") }).run("Build a website");
    assert.equal(title.output[0].content, "Simple Website");
    const agent = createAgent({
      name: "coding", system: "Build a website.", ...createConversationAgentConfig("coding"),
      tools: [createTool({
        name: "createFile", description: "Create a file",
        parameters: z.object({ name: z.string(), content: z.string() }),
        handler: ({ name, content }) => { files.set(name, content); return "Created"; },
      })],
    });
    const result = await createNetwork({
      name: "test-network", agents: [agent], maxIter: 3,
      router: ({ network }) => {
        const output = network.state.results.at(-1)?.output;
        return output?.some((m) => m.type === "text") && !output.some((m) => m.type === "tool_call") ? undefined : agent;
      },
    }).run("Build a website");
    assert.equal(files.get("index.html"), "<h1>Hello</h1>");
    assert.equal(result.state.results.at(-1).output[0].content, "Created your website.");
    assert.equal(requests.length, 3);
    assert.equal(requests[0].generationConfig.maxOutputTokens, 128);
    assert.equal(requests[1].generationConfig.maxOutputTokens, 16000);
    assert.equal(requests[1].generationConfig.thinkingConfig.thinkingLevel, "low");
    assert.ok(requests[2].contents.some((entry) => entry.parts.some((part) => part.functionResponse)));
    assert.ok(requests[2].contents.some((entry) => entry.parts.some((part) => part.thoughtSignature === "signed-tool-call")));
    assert.ok(requests[2].contents.some((entry) => entry.parts.some((part) => part.functionResponse?.id === "google-call-1")));
  } finally {
    globalThis.fetch = originalFetch;
    if (previous === undefined) delete process.env.GOOGLE_GENERATIVE_AI_API_KEY;
    else process.env.GOOGLE_GENERATIVE_AI_API_KEY = previous;
  }
});

test("replayed parallel calls preserve original signed parts and group the model turn", () => {
  const first = { functionCall: { name: "createFile", args: { name: "index.html" } } };
  const second = { functionCall: { name: "createFile", args: { name: "style.css" } } };
  const raw = JSON.stringify({ candidates: [{ content: { role: "model", parts: [
    { text: "Creating files" }, { ...first, thoughtSignature: "original-signature" }, second,
  ] } }] });
  const contents = [
    { role: "user", parts: [{ text: "Build a website" }] },
    { role: "model", parts: [{ text: "Creating files" }] },
    { role: "model", parts: [first] },
    { role: "model", parts: [second] },
    { role: "user", parts: [{ functionResponse: { name: "createFile", response: {} } }] },
  ];
  const restored = restoreGeminiHistory(contents, [raw]);
  assert.equal(restored.length, 3);
  assert.deepEqual(restored[1].parts, JSON.parse(raw).candidates[0].content.parts);
  assert.equal(contents[2].parts[0].thoughtSignature, undefined);
});

test("failure messages explain common causes without exposing raw errors", () => {
  assert.match(getMessageFailureContent("GOOGLE_GENERATIVE_AI_API_KEY is not configured"), /key is missing/);
  assert.match(getMessageFailureContent("429 RESOURCE_EXHAUSTED"), /quota or rate limit/);
  assert.match(getMessageFailureContent("API key not valid"), /credentials or access/);
  assert.match(getMessageFailureContent("404 model not found"), /model is unavailable/);
  assert.doesNotMatch(getMessageFailureContent("secret-key: private-prompt"), /secret-key|private-prompt/);
});
