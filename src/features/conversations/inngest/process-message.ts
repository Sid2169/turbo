import { createAgent, createNetwork } from '@inngest/agent-kit';

import { inngest } from "@/inngest/client";
import { Id } from "../../../../convex/_generated/dataModel";
import { NonRetriableError } from "inngest";
import { convex } from "@/lib/convex-client";
import { api } from "../../../../convex/_generated/api";
import { CODING_AGENT_SYSTEM_PROMPT } from "./constants";
import { DEFAULT_CONVERSATION_TITLE } from "../constants";
import { createReadFilesTool } from './tools/read-files';
import { createListFilesTool } from './tools/list-files';
import { createUpdateFileTool } from './tools/update-file';
import { createCreateFilesTool } from './tools/create-files';
import { createCreateFolderTool } from './tools/create-folder';
import { createRenameFileTool } from './tools/rename-file';
import { createDeleteFilesTool } from './tools/delete-files';
import { createScrapeUrlsTool } from './tools/scrape-urls';
import { createConversationAgentConfig, getMessageFailureContent } from './model';

interface MessageEvent {
  messageId: Id<"messages">;
  conversationId: Id<"conversations">;
  projectId: Id<"projects">;
  message: string;
};

export const processMessage = inngest.createFunction(
  {
    id: "process-message",
    retries: 1,
    cancelOn: [
      {
        event: "message/cancel",
        if: "event.data.messageId == async.data.messageId",
      },
    ],
    onFailure: async ({ event, step }) => {
      const { messageId } = event.data.event.data as MessageEvent;
      const internalKey = process.env.TURBO_CONVEX_INTERNAL_KEY;

      // Update the message with error content
      if (internalKey) {
        await step.run("update-message-on-failure", async () => {
          await convex.mutation(api.system.updateMessageContent, {
            internalKey,
            messageId,
            content: getMessageFailureContent(event.data.error.message),
          });
        });
      }
    }
  },
  {
    event: "message/sent",
  },
  async ({ event, step }) => {
    const { 
      messageId, 
      conversationId,
      projectId,
      message
    } = event.data as MessageEvent;

    const internalKey = process.env.TURBO_CONVEX_INTERNAL_KEY;

    if (!internalKey) {
      throw new NonRetriableError("TURBO_CONVEX_INTERNAL_KEY is not configured");
    }

    // Validate credentials before starting any AI work.
    const codingConfig = createConversationAgentConfig("coding");

    // Get conversation for title generation check
    const conversation = await step.run("get-conversation", async () => {
      return await convex.query(api.system.getConversationById, {
        internalKey,
        conversationId,
      });
    });

    if (!conversation) {
      throw new NonRetriableError("Conversation not found");
    }

    // Fetch recent messages for conversation context
    const recentMessages = await step.run("get-recent-messages", async () => {
      return await convex.query(api.system.getRecentMessages, {
        internalKey,
        conversationId,
        limit: 10,
      });
    });

    // Build system prompt with conversation history (exclude the current processing message)
    let systemPrompt = CODING_AGENT_SYSTEM_PROMPT;

    // Filter out the current processing message and empty messages
    const contextMessages = recentMessages.filter(
      (msg) => msg._id !== messageId && msg.status !== "processing" && msg.content.trim() !== ""
    );

    if (contextMessages.length > 0) {
      const historyText = contextMessages
        .map((msg) => `${msg.role.toUpperCase()}: ${msg.content}`)
        .join("\n\n");

      systemPrompt += `\n\n## Previous Conversation (for context only - do NOT repeat these responses):\n${historyText}\n\n## Current Request:\nRespond ONLY to the user's new message below. Do not repeat or reference your previous responses.`;
    }

    // A title should not add an extra model call before the user's request.
    const shouldGenerateTitle =
      conversation.title === DEFAULT_CONVERSATION_TITLE;

    if (shouldGenerateTitle) {
      const title = message.trim().replace(/\s+/g, " ").slice(0, 60);
      await step.run("update-conversation-title", async () => {
        await convex.mutation(api.system.updateConversationTitle, {
          internalKey, conversationId, title: title || DEFAULT_CONVERSATION_TITLE,
        });
      });
    }

    // Create the coding agent with file tools
    const codingAgent = createAgent({
      name: "polaris",
      description: "An expert AI coding assistant",
      system: systemPrompt,
       ...codingConfig,
       lifecycle: {
        ...codingConfig.lifecycle,
        onStart: async (args) => {
          const start = await codingConfig.lifecycle.onStart!(args);
          const iteration = args.network?.state.results.length ?? 0;
          await step.run(`message-progress-${iteration}`, async () => {
            await convex.mutation(api.system.updateMessageProgress, {
              internalKey, messageId,
              content: iteration === 0
                ? "Working on your request..."
                : `Working on your project (step ${iteration + 1})...`,
            });
          });
          return start;
        },
       },
       tools: [
        createListFilesTool({ internalKey, projectId }),
        createReadFilesTool({ internalKey }),
        createUpdateFileTool({ internalKey }),
        createCreateFilesTool({ projectId, internalKey }),
        createCreateFolderTool({ projectId, internalKey }),
        createRenameFileTool({ internalKey }),
        createDeleteFilesTool({ internalKey }),
        ...(process.env.FIRECRAWL_API_KEY ? [createScrapeUrlsTool()] : []),
       ],
    });

    // Create network with single agent
    const network = createNetwork({
      name: "polaris-network",
      agents: [codingAgent],
      maxIter: 20,
      router: ({ network }) => {
        const lastResult = network.state.results.at(-1);
        const hasTextResponse = lastResult?.output.some(
          (m) => m.type === "text" && m.role === "assistant"
        );
        const hasToolCalls = lastResult?.output.some(
          (m) => m.type === "tool_call"
        );

        // Models can output text AND tool calls together.
        // Only stop if there's text WITHOUT tool calls (final response)
        if (hasTextResponse && !hasToolCalls) {
          return undefined;
        }
        return codingAgent;
      }
    });

    // Run the agent
    const result = await network.run(message);

    // Extract the assistant's text response from the last agent result
    const lastResult = result.state.results.at(-1);
    const textMessage = lastResult?.output.find(
      (m) => m.type === "text" && m.role === "assistant"
    );

    if (!textMessage || lastResult?.output.some((m) => m.type === "tool_call")) {
      throw new NonRetriableError("Coding agent stopped without a final response");
    }

    let assistantResponse = "";

    if (textMessage?.type === "text") {
      assistantResponse =
        typeof textMessage.content === "string"
          ? textMessage.content
          : textMessage.content.map((c) => c.text).join("");
    }

    // Update the assistant message with the response (this also sets status to completed)
    await step.run("update-assistant-message", async () => {
      await convex.mutation(api.system.updateMessageContent, {
        internalKey,
        messageId,
        content: assistantResponse,
      })
    });

    return { success: true, messageId, conversationId };
  }
);
