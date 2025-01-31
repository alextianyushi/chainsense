import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import axios from 'axios';
import { handleLangChainChat } from './langchainHandler';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5001;
const BLOCKSCOUT_API_URL = "https://blockscout.taurus.autonomys.xyz/api/v2";
const REQUIRED_RECIPIENT = process.env.REQUIRED_RECIPIENT;
const REQUIRED_AMOUNT = process.env.REQUIRED_AMOUNT ? BigInt(process.env.REQUIRED_AMOUNT) : null;

if (!REQUIRED_RECIPIENT || REQUIRED_AMOUNT === null) {
  throw new Error("Missing REQUIRED_RECIPIENT or REQUIRED_AMOUNT in .env file.");
}

app.use(cors({ origin: ['https://chainsense.vercel.app'] }));
app.use(express.json());

// Track user storage usage
const userUsage: { [userId: string]: { saveCount: number; loadCount: number } } = {};
const FREE_SAVE_LIMIT = 1;
const FREE_LOAD_LIMIT = 3;

/**
 * Middleware to check if the user has exceeded free usage limits.
 * Also ensures the user has connected a wallet before saving or loading.
 */
const checkUsageLimit = (req: Request, res: Response, next: () => void) => {
  const userId: string = req.body.userId;

  if (!userId) {
    res.status(400).json({ error: 'UserId is required' });
    return;
  }

  // Initialize user usage if not present
  if (!userUsage[userId]) {
    userUsage[userId] = { saveCount: 0, loadCount: 0 };
  }

  next();
};

/**
 * Chat API: Handles AI chat messages.
 * ✅ 允许任何用户（包括未绑定钱包用户）使用。
 */
app.post('/api/chat', checkUsageLimit, async (req: Request, res: Response): Promise<void> => {
  console.log("Origin:", req.headers.origin)
  const userMessage: string = req.body.message;
  const userId: string = req.body.userId;

  if (!userMessage) {
    res.status(400).json({ error: 'Message is required' });
    return;
  }

  try {
    const aiReply = await handleLangChainChat(userMessage, userId);
    res.json({ reply: aiReply });
  } catch (error: any) {
    console.error('Error communicating with AI:', error.message);
    res.status(500).json({ error: 'Error communicating with AI' });
  }
});

/**
 * Save API: Only allows users with a wallet (userId starts with "0x") to save.
 */
app.post('/api/save', checkUsageLimit, async (req: Request, res: Response): Promise<void> => {
  const { userId, password } = req.body;
  console.log('SAVE called by userId=', req.body.userId);

  if (!password) {
    res.status(400).json({ error: 'Password is required' });
    return;
  }

  if (!userId.startsWith("0x")) {
    res.status(403).json({ error: 'Wallet connection required to save data.' });
    return;
  }

  if (userUsage[userId].saveCount >= FREE_SAVE_LIMIT) {
    res.status(403).json({ error: 'Usage limit exceeded. Please make a payment.' });
    return;
  }

  try {
    const saveResponse = await handleLangChainChat(`/save ${password}`, userId);
    userUsage[userId].saveCount++; // Increase save count
    res.json({ message: saveResponse });
  } catch (error: any) {
    console.error('Error saving memory:', error.message);
    res.status(500).json({ error: 'Failed to save memory.' });
  }
});

/**
 * Load API: Only allows users with a wallet (userId starts with "0x") to load.
 */
app.post('/api/load', checkUsageLimit, async (req: Request, res: Response): Promise<void> => {
  const { cid, password, userId } = req.body;

  if (!cid || !password) {
    res.status(400).json({ error: 'CID and password are required' });
    return;
  }

  if (!userId.startsWith("0x")) {
    res.status(403).json({ error: 'Wallet connection required to load data.' });
    return;
  }

  if (userUsage[userId].loadCount >= FREE_LOAD_LIMIT) {
    res.status(403).json({ error: 'Usage limit exceeded. Please make a payment.' });
    return;
  }

  try {
    const loadResponse = await handleLangChainChat(`/load ${cid} ${password}`, userId);
    userUsage[userId].loadCount++; // Increase load count
    res.json({ message: loadResponse });
  } catch (error: any) {
    console.error('Error loading memory:', error.message);
    res.status(500).json({ error: 'Failed to load memory. Please try again later.' });
  }
});

/**
 * Payment Verification API: Verifies a payment transaction.
 */
app.post('/api/check-payment', async (req: Request, res: Response): Promise<void> => {
  const { txHash, userId } = req.body;

  if (!txHash || !userId) {
    res.status(400).json({ error: 'Transaction hash and userId are required' });
    return;
  }

  try {
    const response = await axios.get(`${BLOCKSCOUT_API_URL}/transactions/${txHash}`, {
      headers: { 'Accept': 'application/json' },
    });

    if (response.status !== 200 || !response.data) {
      res.status(404).json({ error: 'Transaction not found' });
      return;
    }

    const transaction = response.data;

    const isStatusOk = transaction.status === "ok";
    const isRecipientCorrect = transaction.to.hash.toLowerCase() === REQUIRED_RECIPIENT.toLowerCase();
    const isSenderCorrect = transaction.from.hash.toLowerCase() === userId.toLowerCase();
    const isAmountCorrect = BigInt(transaction.value) === REQUIRED_AMOUNT;

    if (isStatusOk && isRecipientCorrect && isSenderCorrect && isAmountCorrect) {
      res.json({ success: true, message: "Transaction verified successfully!" });
    } else {
      res.json({
        success: false,
        message: "Transaction verification failed.",
        details: {
          status: isStatusOk ? "✅ OK" : "❌ NOT OK",
          recipient: isRecipientCorrect ? "✅ Correct" : "❌ Incorrect",
          sender: isSenderCorrect ? "✅ Correct" : "❌ Incorrect",
          amount: isAmountCorrect ? "✅ Correct" : "❌ Incorrect",
        },
      });
    }
  } catch (error: any) {
    console.error('Error checking transaction:', error.response ? error.response.data : error.message);
    res.status(500).json({ error: 'Failed to verify transaction.' });
  }
});

/**
 * Reset Usage API: Resets usage count for users who have paid.
 */
app.post('/api/reset-usage', async (req: Request, res: Response): Promise<void> => {
  const { userId, txHash } = req.body;

  if (!userId || !txHash) {
    res.status(400).json({ error: 'UserId and transaction hash are required' });
    return;
  }

  try {
    const paymentResponse = await axios.post(`http://localhost:${PORT}/api/check-payment`, { txHash, userId });

    if (paymentResponse.data.success) {
      userUsage[userId] = { saveCount: 0, loadCount: 0 };
      res.json({ success: true, message: "User usage reset successfully after payment verification." });
    } else {
      res.json({ success: false, message: "Payment verification failed. Unable to reset usage." });
    }
  } catch (error: any) {
    console.error('Error resetting usage:', error.message);
    res.status(500).json({ error: 'Failed to reset usage.' });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});








