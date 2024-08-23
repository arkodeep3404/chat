import dotenv from "dotenv";
dotenv.config();

import { DynamoDBChatMessageHistory } from "@langchain/community/stores/message/dynamodb";
import { ChatOpenAI } from "@langchain/openai";
import { RunnableWithMessageHistory } from "@langchain/core/runnables";
import {
  ChatPromptTemplate,
  MessagesPlaceholder,
} from "@langchain/core/prompts";
import { StringOutputParser } from "@langchain/core/output_parsers";

const model = new ChatOpenAI({
  modelName: "gpt-3.5-turbo",
  openAIApiKey: process.env.OPENAI_API_KEY,
});

const prompt = ChatPromptTemplate.fromMessages([
  [
    "system",
    "You are a helpful assistant. Answer all questions to the best of your ability.",
  ],
  new MessagesPlaceholder("chat_history"),
  ["human", "{input}"],
]);

const chain = prompt.pipe(model).pipe(new StringOutputParser());

const chainWithHistory = new RunnableWithMessageHistory({
  runnable: chain,
  inputMessagesKey: "input",
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

const res2 = await chainWithHistory.invoke(
  { input: "What did I just say my name was?" },
  { configurable: { sessionId: "test" } }
);
console.log(res2);

/*
  "You said your name was MJDeligan."
*/
