import dotenv from "dotenv";
dotenv.config();

import { tool } from "@langchain/core/tools";
import { DynamoDBChatMessageHistory } from "@langchain/community/stores/message/dynamodb";
import { AzureChatOpenAI } from "@langchain/openai";
import { RunnableWithMessageHistory } from "@langchain/core/runnables";
import {
  ChatPromptTemplate,
  MessagesPlaceholder,
} from "@langchain/core/prompts";

import {
  DynamoDBClient,
  GetItemCommand,
  UpdateItemCommand,
} from "@aws-sdk/client-dynamodb";

const client = new DynamoDBClient({ region: process.env.AWS_REGION });

async function updateLastMessagesAdditionalKwargs(userSessionId) {
  const getParams = {
    TableName: process.env.AWS_TABLE_NAME,
    Key: {
      id: { S: userSessionId },
    },
  };

  try {
    const getData = await client.send(new GetItemCommand(getParams));
    const messages = getData.Item.messages.L;
    const messagesLength = messages.length;

    if (messagesLength === 0) {
      return "no messages found";
    }

    const updateParams = {
      TableName: process.env.AWS_TABLE_NAME,
      Key: {
        id: { S: userSessionId },
      },
      UpdateExpression: `SET #messages[${messagesLength - 1}].#ak = :emptyObj`,
      ExpressionAttributeNames: {
        "#messages": "messages",
        "#ak": "additional_kwargs",
      },
      ExpressionAttributeValues: {
        ":emptyObj": { S: "{}" },
      },
      ReturnValues: "UPDATED_NEW",
    };

    const updateData = await client.send(new UpdateItemCommand(updateParams));
    return updateData;
  } catch (err) {
    return err;
  }
}

const prompt = ChatPromptTemplate.fromMessages([
  [
    "system",
    ` You are a helpful assistant. Answer all questions to the best of your ability. 
    ONLY if the user asks you to send them ANY kind of image/picture call the Get-Image-Tool tool,
    WITHOUT asking the user any details about the image/picture. `,
  ],
  new MessagesPlaceholder("chat_history"),
  ["human", "{input}"],
]);

const getImageTool = tool(
  async (userSessionId) => {
    return `image url for ${userSessionId}`;
  },
  {
    name: "Get-Image-Tool",
    description:
      "Use this tool ONLY if the user asks you to send them ANY kind of image/picture",
  }
);

const llm = new AzureChatOpenAI({
  model: "gpt-4o-mini",
}).bindTools([getImageTool]);

const chain = prompt.pipe(llm);

const runnableWithChatHistory = new RunnableWithMessageHistory({
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

// const res1 = await runnableWithChatHistory.invoke(
//   {
//     input: "my name is arkodeep",
//   },
//   { configurable: { sessionId: "test" } }
// );

// console.log(res1);
// console.log(res1.tool_calls.length === 0);

// if (res1.tool_calls.length !== 0) {
//   await updateLastMessagesAdditionalKwargs();
// }

const res2 = await runnableWithChatHistory.invoke(
  { input: "what is my name?" },
  { configurable: { sessionId: process.env.SESSION_ID } }
);

console.log(res2);

if (res2.tool_calls.length === 0) {
  console.log(res2.content);
} else if (res2.tool_calls.length !== 0) {
  console.log(await updateLastMessagesAdditionalKwargs(process.env.SESSION_ID));
  console.log(await getImageTool.invoke(process.env.SESSION_ID));
} else {
  console.log("please try again");
}
