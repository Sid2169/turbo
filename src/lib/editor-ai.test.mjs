import assert from "node:assert/strict";
import { test } from "node:test";
import { APICallError } from "ai";
import { z } from "zod";
import { generateEditorResult, getEditorError } from "./editor-ai.ts";

test("editor features use Google structured output with minimal thinking", async () => {
  const originalKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  const originalFetch = globalThis.fetch;
  process.env.GOOGLE_GENERATIVE_AI_API_KEY = "test-key";
  const requests = [];
  globalThis.fetch = async (url, init) => {
    requests.push({ url: String(url), body: JSON.parse(init.body) });
    return Response.json({ candidates: [{
      content: { role: "model", parts: [{ text: '{"code":"console.log(1);"}' }] },
      finishReason: "STOP",
    }], usageMetadata: { promptTokenCount: 1, candidatesTokenCount: 1, totalTokenCount: 2 } });
  };
  try {
    for (const purpose of ["suggestion", "edit"]) {
      const output = await generateEditorResult({ purpose, schema: z.object({ code: z.string() }), prompt: "Print 1" });
      assert.equal(output.code, "console.log(1);");
    }
    assert.match(requests[0].url, /gemini-3.5-flash-lite/);
    assert.match(requests[1].url, /gemini-3.6-flash/);
    for (const { body } of requests) {
      assert.equal(body.generationConfig.responseMimeType, "application/json");
      assert.equal(body.generationConfig.thinkingConfig.thinkingLevel, "minimal");
    }
  } finally {
    globalThis.fetch = originalFetch;
    if (originalKey === undefined) delete process.env.GOOGLE_GENERATIVE_AI_API_KEY;
    else process.env.GOOGLE_GENERATIVE_AI_API_KEY = originalKey;
  }
});

test("quota failures are not silently retried and return a safe message", async () => {
  const originalKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  const originalFetch = globalThis.fetch;
  process.env.GOOGLE_GENERATIVE_AI_API_KEY = "test-key";
  let attempts = 0;
  globalThis.fetch = async () => {
    attempts++;
    return Response.json({ error: { code: 429, message: "private-provider-details", status: "RESOURCE_EXHAUSTED" } }, { status: 429 });
  };
  try {
    await assert.rejects(generateEditorResult({ purpose: "suggestion", schema: z.object({ code: z.string() }), prompt: "Print 1" }), (error) => {
      assert.equal(getEditorError(error).status, 429);
      assert.doesNotMatch(getEditorError(error).error, /private-provider-details/);
      return true;
    });
    assert.equal(attempts, 1);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalKey === undefined) delete process.env.GOOGLE_GENERATIVE_AI_API_KEY;
    else process.env.GOOGLE_GENERATIVE_AI_API_KEY = originalKey;
  }
});

test("credential, model and timeout errors produce actionable messages", () => {
  assert.equal(getEditorError(new Error("GOOGLE_GENERATIVE_AI_API_KEY is not configured")).status, 503);
  assert.match(getEditorError(new APICallError({ message: "API key not valid", statusCode: 400, url: "https://example.test", requestBodyValues: {} })).error, /API key/);
  assert.match(getEditorError(new APICallError({ message: "not found", statusCode: 404, url: "https://example.test", requestBodyValues: {} })).error, /model/);
  assert.equal(getEditorError(new DOMException("timeout", "TimeoutError")).status, 504);
});
