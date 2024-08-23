import dotenv from "dotenv";
dotenv.config();

import { tool } from "@langchain/core/tools";

import { DynamoDBChatMessageHistory } from "@langchain/community/stores/message/dynamodb";
import { ChatOpenAI } from "@langchain/openai";
import { RunnableWithMessageHistory } from "@langchain/core/runnables";
import {
  ChatPromptTemplate,
  MessagesPlaceholder,
} from "@langchain/core/prompts";
import { HumanMessage } from "@langchain/core/messages";
import { AgentExecutor, createToolCallingAgent } from "langchain/agents";

const prompt = ChatPromptTemplate.fromMessages([
  [
    "system",
    "You are a helpful assistant. Answer all questions to the best of your ability.",
  ],
  new MessagesPlaceholder("chat_history"),
  ["human", "{input}"],
  ["placeholder", "{agent_scratchpad}"],
]);

const imageTool = tool(
  async () => {
    return "image url";
  },
  {
    name: "Get-Image-Tool",
    description:
      "Use this tool if the user asks you to send them an image/picture",
  }
);

const llm = new ChatOpenAI({
  modelName: "gpt-4o-mini",
  openAIApiKey: process.env.OPENAI_API_KEY,
});

const tools = [imageTool];

const agent = await createToolCallingAgent({
  llm,
  tools,
  prompt,
});

const agentExecutor = new AgentExecutor({ agent, tools });

const conversationalAgentExecutor = new RunnableWithMessageHistory({
  runnable: agentExecutor,
  inputMessagesKey: "input",
  outputMessagesKey: "output",
  historyMessagesKey: "chat_history",
  getMessageHistory: async (sessionId) => {
    return new DynamoDBChatMessageHistory({
      tableName: process.env.AWS_TABLE_NAME,
      partitionKey: process.env.AWS_TABLE_PARTITION_KEY,
      sessionId,
      config: {
        region: process.env.AWS_REGION,
        credentials: {
          accessKeyId: process.env.AWS_ACCESS_KEY_ID,
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
        },
      },
    });
  },
});

// const res1 = await chainWithHistory.invoke(
//   {
//     input: "Hi! I'm Arkodeep",
//   },
//   { configurable: { sessionId: "test" } }
// );
// console.log(res1);

/*
  "Hello MJDeligan! It's nice to meet you. My name is AI. How may I assist you today?"
*/

const res2 = await conversationalAgentExecutor.invoke(
  { input: [new HumanMessage("send me a pic")] },
  { configurable: { sessionId: "test" } }
);
console.log(res2);

/*
  "You said your name was MJDeligan."
*/
