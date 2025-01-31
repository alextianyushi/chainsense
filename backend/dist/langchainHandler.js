"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleLangChainChat = void 0;
//src/langchainHandler.ts
const openai_1 = require("@langchain/openai");
const messages_1 = require("@langchain/core/messages");
const dotenv_1 = __importDefault(require("dotenv"));
const drive_1 = require("./drive");
dotenv_1.default.config();
const userConversations = {};
/**
 * Handle user chat with the AI and optionally save/load the conversation.
 * @param userMessage The user's input message.
 * @param userId The unique user ID.
 * @returns The AI's response, save confirmation, or load status.
 */
const handleLangChainChat = (userMessage, userId) => __awaiter(void 0, void 0, void 0, function* () {
    const chat = new openai_1.ChatOpenAI({
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
        const conversationLog = userConversations[userId].messages.map((message) => `User: ${message.user}\nAI: ${message.ai}`);
        const logContent = {
            [userId]: { messages: conversationLog },
        };
        try {
            const cid = yield (0, drive_1.uploadFileFromMemory)(logContent, `conversation_${userId}_${Date.now()}.json`, password, userId);
            return `Conversation saved!\nCID: ${cid}\nPassword: ${password}`;
        }
        catch (error) {
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
            const fileContent = yield (0, drive_1.downloadFileFromAutoDrive)(cid, password);
            userConversations[userId].memory += `\n${JSON.stringify(fileContent, null, 2)}`;
            return `Memory loaded! CID: ${cid}`;
        }
        catch (error) {
            console.error('Failed to load memory:', error);
            return 'Error loading memory. Check CID and password.';
        }
    }
    // Process normal chat messages
    try {
        const memory = userConversations[userId].memory;
        const messages = [
            new messages_1.SystemMessage(helpContext),
            ...(memory ? [new messages_1.SystemMessage(`Context: ${memory}`)] : []),
            new messages_1.HumanMessage(userMessage),
        ];
        const response = yield chat.invoke(messages);
        const aiResponse = Array.isArray(response.content)
            ? response.content.join('\n')
            : response.content;
        userConversations[userId].messages.push({ user: userMessage, ai: aiResponse });
        return aiResponse;
    }
    catch (error) {
        console.error('Error during chat:', error);
        return 'Error communicating with AI.';
    }
});
exports.handleLangChainChat = handleLangChainChat;
