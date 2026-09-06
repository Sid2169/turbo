// Live smoke check: tiny prompts, one read-only tool, no project data or writes.
import nextEnv from "@next/env";
import { createAgent, createNetwork, createTool } from "@inngest/agent-kit";
import { z } from "zod";
import { createConversationModel, createConversationAgentConfig } from "../src/features/conversations/inngest/model.ts";
import { generateEditorResult } from "../src/lib/editor-ai.ts";

nextEnv.loadEnvConfig(process.cwd());
if (process.env.DEBUG_MODEL_CHECK === "1") {
  const fetchOriginal = globalThis.fetch;
  const shape = (content) => ({ role: content.role, parts: content.parts?.map((part) => ({
    keys: Object.keys(part), functionKeys: part.functionCall ? Object.keys(part.functionCall) : [],
  })) });
  globalThis.fetch = async (url, init) => {
    console.log("Request shape", JSON.stringify(JSON.parse(init.body).contents?.map(shape)));
    const response = await fetchOriginal(url, init);
    const data = await response.clone().json();
    console.log("Response shape", JSON.stringify(data.candidates?.map((candidate) => shape(candidate.content))));
    return response;
  };
}
try {
  for (const purpose of ["suggestion", "edit"]) {
    const started = performance.now();
    const output = await generateEditorResult({
      purpose,
      schema: z.object({ code: z.string() }),
      prompt: "Return a single JavaScript console.log statement that prints hello in the code field.",
    });
    if (!output.code.includes("console.log")) throw new Error(`${purpose} returned no usable code`);
    console.log(`Live ${purpose} passed (${Math.round(performance.now() - started)} ms)`);
  }
  const started = performance.now();
  const title = await createAgent({
    name: "title-check", system: "Return a short website title.",
    model: createConversationModel("title"),
  }).run("A simple HTML website");
  if (!title.output.some((part) => part.type === "text")) throw new Error("No title returned");
  console.log("Title generation passed");
  let calls = 0;
  const agent = createAgent({
    name: "tool-check",
    system: "Call listFiles once, then report the returned filename. Do not invent filenames.",
    ...createConversationAgentConfig("coding"),
    tools: [createTool({
      name: "listFiles", description: "List the files in a test project", parameters: z.object({}),
      handler: () => { calls++; return JSON.stringify(["smoke-check.html"]); },
    })],
  });
  const result = await createNetwork({
    name: "model-check", agents: [agent], maxIter: 3,
    router: ({ network }) => {
      const output = network.state.results.at(-1)?.output;
      return output?.some((m) => m.type === "text") && !output.some((m) => m.type === "tool_call") ? undefined : agent;
    },
  }).run("List the test project's files using listFiles, then tell me the filename.");
  if (!calls || !JSON.stringify(result.state.results.at(-1)?.output).includes("smoke-check.html")) {
    throw new Error("Tool round trip did not finish correctly");
  }
  console.log(`Live title and tool round trip passed (${Math.round(performance.now() - started)} ms)`);
} catch (error) {
  const key = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  const message = String(error.message);
  console.error(key ? message.split(key).join("[redacted]") : message);
  process.exitCode = 1;
}
