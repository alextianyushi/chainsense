//src/langchainHandler.ts
import { ChatOpenAI } from "@langchain/openai";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import dotenv from 'dotenv';
import { uploadFileFromMemory, downloadFileFromAutoDrive } from './drive';

dotenv.config(); 

const userConversations: { 
  [userId: string]: { 
    messages: { user: string; ai: string }[], 
    memory: string 
  } 
} = {};

/**
 * Handle user chat with the AI and optionally save/load the conversation.
 * @param userMessage The user's input message.
 * @param userId The unique user ID.
 * @returns The AI's response, save confirmation, or load status.
 */
export const handleLangChainChat = async (userMessage: string, userId: string): Promise<string> => {
  const chat = new ChatOpenAI({
    temperature: 0.5,
    modelName: 'gpt-4',
    openAIApiKey: process.env.OPENAI_API_KEY,
  });

  if (!userConversations[userId]) {
    userConversations[userId] = { messages: [], memory: '' };
  }

  // Help message
  const helpContext = `
    You can save or load conversations securely:
    - Save: /save password
    - Load: /load CID password
  `;

  /** ✅ Ensure userId is a valid wallet address before saving */
  if (userMessage.startsWith('/save')) {
    if (!userId.startsWith("0x")) {
      return 'Wallet connection required to save data.';
    }

    const password = userMessage.split(' ')[1];
    if (!password) {
      return 'Please provide a password: /save password';
    }

    const conversationLog = userConversations[userId].messages.map(
      (message) => `User: ${message.user}\nAI: ${message.ai}`
    );

    const logContent = {
      [userId]: { messages: conversationLog },
    };

    try {
      const cid = await uploadFileFromMemory(
        logContent, 
        `conversation_${userId}_${Date.now()}.json`,
        password,
        userId
      );
      return `Conversation saved!\nCID: ${cid}\nPassword: ${password}`;
    } catch (error) {
      console.error('Failed to upload:', error);
      return 'Error saving conversation. Try again later.';
    }
  }

  /** ✅ Ensure userId is a valid wallet address before loading */
  if (userMessage.startsWith('/load')) {
    if (!userId.startsWith("0x")) {
      return 'Wallet connection required to load data.';
    }

    const [_, cid, password] = userMessage.split(' ');
    if (!cid || !password) {
      return 'Please provide both CID and password: /load CID password';
    }

    try {
      const fileContent = await downloadFileFromAutoDrive(cid, password);
      userConversations[userId].memory += `\n${JSON.stringify(fileContent, null, 2)}`;
      return `Memory loaded! CID: ${cid}`;
    } catch (error) {
      console.error('Failed to load memory:', error);
      return 'Error loading memory. Check CID and password.';
    }
  }

  // Process normal chat messages
  try {
    const memory = userConversations[userId].memory;
    const messages = [
      new SystemMessage(helpContext),
      ...(memory ? [new SystemMessage(`Context: ${memory}`)] : []),
      new HumanMessage(userMessage),
    ];

    const response = await chat.invoke(messages);
    const aiResponse = Array.isArray(response.content)
      ? response.content.join('\n')
      : response.content;

    userConversations[userId].messages.push({ user: userMessage, ai: aiResponse });

    return aiResponse;
  } catch (error) {
    console.error('Error during chat:', error);
    return 'Error communicating with AI.';
  }
};












