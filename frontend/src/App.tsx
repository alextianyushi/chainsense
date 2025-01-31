// src/App.tsx
import React, { CSSProperties, useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';
import { MetaMaskInpageProvider } from '@metamask/providers';

declare global {
  interface Window {
    ethereum?: MetaMaskInpageProvider;
  }
}

interface Message {
  sender: 'user' | 'ai';
  text: string;
}

interface ChatResponse {
  reply: string | string[];
  message?: string;
}

function App() {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [paymentInProgress, setPaymentInProgress] = useState(false);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  // Define payment amount and recipient address
  const PAYMENT_AMOUNT_WEI = '1000000000000000'; // 
  const PAYMENT_RECIPIENT = '0xB47C702eAe7a26A7d76eC183683C3BF3636D6a14';

  // Generate a random UUID if there's no wallet session; otherwise, use localStorage
  const [userId, setUserId] = useState(() => {
    let sessionId = localStorage.getItem('sessionId');
    if (!sessionId) {
      sessionId = uuidv4();
      localStorage.setItem('sessionId', sessionId);
    }
    return sessionId;
  });

  useEffect(() => {
    document.title = 'ChainSense - Your Secure Assistant';
  }, []);

  useEffect(() => {
    const welcomeMessage: Message = {
      sender: 'ai',
      text: `
        Hey there! I'm Linky, your secure assistant, here to help you explore insights, brainstorm ideas, or even chat about your next big project. 🌟
        
        Just so you know, every conversation we have can be safely stored on Auto Drive (https://ai3.storage/drive), powered by the Autonomys blockchain. This means your records are securely encrypted and always accessible.
  
        If you ever want to save our chat, simply type '/save password'. To revisit past memories, type '/load CID password', and I'll load that conversation right into my local memory. Let's dive in and make some magic happen! ✨
      `,
    };
    setMessages([welcomeMessage]);
  }, []);

  // MetaMask Login
  const handleMetaMaskLogin = async () => {
    if (!window.ethereum) {
      alert('MetaMask is not installed.');
      return;
    }

    try {
      const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' }) as string[];
      if (accounts && accounts.length > 0) {
        const walletAddress = accounts[0];
        setUserId(walletAddress);
        localStorage.setItem('sessionId', walletAddress);
        alert(`Wallet connected: ${walletAddress}`);

        // Add a message to the chat to prompt the user
        const loginMessage: Message = { sender: 'ai', text: 'Try save/load after logging in.' };
        setMessages((prev) => [...prev, loginMessage]);
      } else {
        alert('No accounts found. Please check your MetaMask wallet.');
      }
    } catch (error) {
      console.error('MetaMask login failed:', error);
      alert('Failed to connect MetaMask. Please try again.');
    }
  };

  // Disconnect Wallet
  const handleDisconnectWallet = () => {
    const sessionId = uuidv4();
    localStorage.setItem('sessionId', sessionId);
    setUserId(sessionId);
    alert('Wallet disconnected. Using temporary session ID.');
  };

  // Initiate Payment
  const initiatePayment = async (): Promise<string | null> => {
    if (!window.ethereum) {
      alert('MetaMask is not installed.');
      return null;
    }

    try {
      const transactionParameters = {
        to: PAYMENT_RECIPIENT, // Recipient address
        from: userId, // User's wallet address
        value: "0x" + BigInt(PAYMENT_AMOUNT_WEI).toString(16), // Payment amount (in Wei)
      };

      // Request MetaMask to initiate the transaction
      const txHash = await window.ethereum.request({
        method: 'eth_sendTransaction',
        params: [transactionParameters],
      });

      console.log('Transaction sent. TX Hash:', txHash);
      alert('Transaction sent. Please wait for confirmation.');
      return txHash as string;
    } catch (error: any) {
      console.error('Payment failed:', error);
      alert('Payment failed or was rejected.');
      return null;
    }
  };

  // Add a function to wait for the transaction to be mined
  const waitForTransaction = async (txHash: string): Promise<boolean> => {
    if (!window.ethereum) {
      alert('MetaMask is not installed.');
      return false;
    }

    const maxAttempts = 10;
    const delay = 3000; // 3 seconds
    let attempts = 0;

    while (attempts < maxAttempts) {
      try {
        const receipt = await window.ethereum.request({
          method: 'eth_getTransactionReceipt',
          params: [txHash],
        }) as { status: string } | null;

        if (receipt) {
          if (receipt.status === '0x1') {
            console.log('Transaction mined successfully:', receipt);
            return true;
          } else {
            console.log('Transaction failed:', receipt);
            return false;
          }
        } else {
          console.log('Transaction not mined yet, retrying...');
        }
      } catch (error) {
        console.error('Error waiting for transaction:', error);
      }

      attempts++;
      await new Promise((resolve) => setTimeout(resolve, delay));
    }

    alert('Transaction was not mined successfully after multiple attempts.');
    return false;
  };

  // Modify the checkPayment function to retry up to 5 times
  const checkPayment = async (txHash: string): Promise<boolean> => {
    let attempts = 0;
    const maxAttempts = 5;

    while (attempts < maxAttempts) {
      try {
        const response = await axios.post<{ success: boolean; message: string }>(
          'https://chainsense.onrender.com/api/check-payment',
          { txHash, userId },
          { headers: { 'Content-Type': 'application/json' } }
        );

        if (response.data.success) {
          alert('Transaction verified successfully!');
          return true;
        } else {
          console.log('Transaction verification failed: ' + response.data.message);
        }
      } catch (error: any) {
        console.error('Check payment failed:', error.response?.data || error.message);
      }

      attempts++;
      if (attempts < maxAttempts) {
        console.log(`Retrying check payment... Attempt ${attempts + 1}`);
        await new Promise((resolve) => setTimeout(resolve, 2000)); // Wait 2 seconds before retrying
      }
    }

    alert('Transaction verification failed after multiple attempts.');
    return false;
  };

  // Call the backend's /api/reset-usage
  const resetUsage = async (txHash: string) => {
    try {
      const response = await axios.post<{ success: boolean; message: string }>(
        'https://chainsense.onrender.com/api/reset-usage',
        { userId, txHash },
        { headers: { 'Content-Type': 'application/json' } }
      );

      if (response.data.success) {
        alert('Usage has been successfully reset!');
      } else {
        alert('Failed to reset usage: ' + response.data.message);
      }
    } catch (error: any) {
      console.error('Reset usage failed:', error.response?.data || error.message);
      alert('Failed to reset usage.');
    }
  };

  // Modify the sendMessage function to use waitForTransaction and ensure resetUsage is called correctly
  const sendMessage = async () => {
    if (input.trim() === '') return;

    // Trim the input
    const trimmedInput = input.trim();

    // Add user message to chat
    const userMessage: Message = { sender: 'user', text: trimmedInput };
    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    // Check if it's a command
    if (trimmedInput.startsWith('/save')) {
      // Ensure the user has connected their wallet
      if (!userId.startsWith('0x')) {
        alert('You must connect a wallet first to use the /save command.');
        setLoading(false);
        return;
      }

      // Extract the password
      const parts = trimmedInput.split(' ');
      if (parts.length < 2) {
        alert("Please provide a password using the format: /save password.");
        setLoading(false);
        return;
      }
      const password = parts[1];

      // Call /api/save
      try {
        const response = await axios.post<{ message: string }>(
          'https://chainsense.onrender.com/api/save',
          { userId, password },
          { headers: { 'Content-Type': 'application/json' } }
        );

        const saveMessage: Message = { sender: 'ai', text: response.data.message };
        setMessages((prev) => [...prev, saveMessage]);
      } catch (error: any) {
        console.error('Failed to save conversation:', error.response?.data || error.message);
        const errorText = error.response?.data?.error || 'Failed to save conversation.';
        const errorMessage: Message = { sender: 'ai', text: errorText };
        setMessages((prev) => [...prev, errorMessage]);

        // If usage limit exceeded, automatically initiate payment
        if (error.response?.status === 403 && error.response.data.error.includes('Usage limit exceeded')) {
          setPaymentInProgress(true);
          const txHash = await initiatePayment();
          if (txHash) {
            const isMined = await waitForTransaction(txHash);
            if (isMined) {
              const isPaymentValid = await checkPayment(txHash);
              if (isPaymentValid) {
                await resetUsage(txHash);
              } else {
                alert('Transaction verification failed. Please try again.');
              }
            } else {
              alert('Transaction was not mined successfully. Please try again.');
            }
          }
          setPaymentInProgress(false);

          // Add additional message after payment process
          const retryMessage: Message = { sender: 'ai', text: 'Try command again after payment.' };
          setMessages((prev) => [...prev, retryMessage]);
        }
      } finally {
        setLoading(false);
      }
      return;
    }

    if (trimmedInput.startsWith('/load')) {
      // Ensure the user has connected their wallet
      if (!userId.startsWith('0x')) {
        alert('You must connect a wallet first to use the /load command.');
        setLoading(false);
        return;
      }

      // Extract CID and password
      const parts = trimmedInput.split(' ');
      if (parts.length < 3) {
        alert("Please provide both CID and password using the format: /load CID password.");
        setLoading(false);
        return;
      }
      const cid = parts[1];
      const password = parts[2];

      // Call /api/load
      try {
        const response = await axios.post<{ data: any }>(
          'https://chainsense.onrender.com/api/load',
          { userId, cid, password },
          { headers: { 'Content-Type': 'application/json' } }
        );

        // Process the loaded data
        const loadedData = response.data.data;
        let formattedMessage = '';

        // Check if loadedData is defined and process it
        if (loadedData) {
          if (Array.isArray(loadedData)) {
            // If the data is an array, concatenate items into a single message
            formattedMessage = loadedData.join('\n');
          } else {
            // If the data is a single object or string, convert it to a string
            formattedMessage = JSON.stringify(loadedData);
          }
        }

        // Construct the success message
        let successText = `Data CID ${cid} is loaded successfully!`;
        if (formattedMessage) {
          successText += `\n${formattedMessage}`;
        }

        // Add a success message to the chat with CID and the loaded data
        const successMessage: Message = { sender: 'ai', text: successText };
        setMessages((prev) => [...prev, successMessage]);

      } catch (error: any) {
        console.error('Failed to load data:', error.response?.data || error.message);
        const errorText = error.response?.data?.error || 'Failed to load data.';
        const errorMessage: Message = { sender: 'ai', text: errorText };
        setMessages((prev) => [...prev, errorMessage]);

        // If usage limit exceeded, automatically initiate payment
        if (error.response?.status === 403 && error.response.data.error.includes('Usage limit exceeded')) {
          setPaymentInProgress(true);
          const txHash = await initiatePayment();
          if (txHash) {
            const isMined = await waitForTransaction(txHash);
            if (isMined) {
              const isPaymentValid = await checkPayment(txHash);
              if (isPaymentValid) {
                await resetUsage(txHash);
              } else {
                alert('Transaction verification failed. Please try again.');
              }
            } else {
              alert('Transaction was not mined successfully. Please try again.');
            }
          }
          setPaymentInProgress(false);

          // Add additional message after payment process
          const retryMessage: Message = { sender: 'ai', text: 'Try command again after payment.' };
          setMessages((prev) => [...prev, retryMessage]);
        }
      } finally {
        setLoading(false);
      }
      return;
    }

    // If not a command, send to /api/chat
    try {
      const response = await axios.post<ChatResponse>(
        'https://chainsense.onrender.com/api/chat',
        { message: trimmedInput, userId },
        { headers: { 'Content-Type': 'application/json' } }
      );

      const replies = Array.isArray(response.data.reply)
        ? response.data.reply
        : [response.data.reply];

      replies.forEach((text) => {
        const aiMessage: Message = { sender: 'ai', text };
        setMessages((prev) => [...prev, aiMessage]);
      });
    } catch (error) {
      console.error('Failed to communicate with AI:', error);
      const errorMessage: Message = { sender: 'ai', text: 'Sorry, something went wrong.' };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      sendMessage();
    }
  };

  const handleClearChat = () => {
    const welcomeMessage: Message = {
      sender: 'ai',
      text: `
        Hey there! I'm Linky, your secure assistant, here to help you explore insights, brainstorm ideas, or even chat about your next big project. 🌟
        
        Just so you know, every conversation we have can be safely stored on Auto Drive (https://ai3.storage/drive), powered by the Autonomys blockchain. This means your records are securely encrypted and always accessible.
  
        If you ever want to save our chat, login in first through metamask and simply type '/save password'. To revisit past memories, type '/load CID password', and I'll load that conversation right into my local memory. Let's dive in and make some magic happen! ✨
      `,
    };
    setMessages([welcomeMessage]);
  };

  // Scroll to the bottom of the chat when a new message or loading state changes
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [messages, loading, paymentInProgress]);

  const styles: { [key: string]: CSSProperties } = {
    container: {
      padding: '20px',
      fontFamily: 'Arial, sans-serif',
      maxWidth: '600px',
      margin: '0 auto',
      position: 'relative',
    },
    title: {
      textAlign: 'center',
      marginBottom: '20px',
    },
    chatContainer: {
      border: '1px solid #ccc',
      borderRadius: '8px',
      padding: '10px',
      height: '300px',
      overflowY: 'scroll',
      backgroundColor: '#f9f9f9',
    },
    userMessage: {
      textAlign: 'right',
      margin: '10px 0',
    },
    aiMessage: {
      textAlign: 'left',
      margin: '10px 0',
    },
    messageText: {
      display: 'inline-block',
      padding: '10px',
      borderRadius: '12px',
      maxWidth: '80%',
      wordWrap: 'break-word',
    },
    inputContainer: {
      display: 'flex',
      gap: '10px',
      marginTop: '10px',
    },
    input: {
      flex: 1,
      padding: '10px',
      fontSize: '16px',
      borderRadius: '8px',
      border: '1px solid #ccc',
    },
    button: {
      padding: '10px 20px',
      fontSize: '16px',
      borderRadius: '8px',
      backgroundColor: '#007bff',
      color: 'white',
      border: 'none',
      cursor: 'pointer',
    },
    loadingText: {
      marginTop: '10px',
      textAlign: 'center',
      color: '#555',
    },
    walletContainer: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'flex-end',
      gap: '10px',
      position: 'fixed',
      top: '10px',
      right: '10px',
      width: '100%',
      paddingRight: '20px',
      boxSizing: 'border-box',
    },
    walletButton: {
      padding: '10px 15px',
      fontSize: '14px',
      borderRadius: '5px',
      backgroundColor: '#28a745',
      color: 'white',
      border: 'none',
      cursor: 'pointer',
    },
    walletText: {
      fontSize: '14px',
      color: '#555',
    },
    paymentMessage: {
      textAlign: 'center',
      color: '#ff0000',
      marginTop: '10px',
    },
  };

  return (
    <div style={styles.container}>
      <div style={styles.walletContainer}>
        {userId.startsWith('0x') ? (
          <>
            <span style={styles.walletText}>
              Wallet: {userId.slice(0, 6)}...{userId.slice(-4)}
            </span>
            <button style={styles.walletButton} onClick={handleDisconnectWallet}>
              Disconnect
            </button>
          </>
        ) : (
          <button style={styles.walletButton} onClick={handleMetaMaskLogin}>
            Connect Wallet
          </button>
        )}
      </div>
      <h1 style={styles.title}>Linky - Your Secure Assistant</h1>
      <div style={styles.chatContainer} ref={chatContainerRef}>
        {messages.map((msg, index) => (
          <div
            key={index}
            style={msg.sender === 'user' ? styles.userMessage : styles.aiMessage}
          >
            <p
              style={{
                ...styles.messageText,
                backgroundColor: msg.sender === 'user' ? '#d1e7ff' : '#e6e6e6',
              }}
            >
              <strong>{msg.sender === 'user' ? 'You' : 'Linky'}:</strong> {msg.text}
            </p>
          </div>
        ))}
        {loading && (
          <div style={styles.aiMessage}>
            <p style={{ ...styles.messageText, backgroundColor: '#e6e6e6' }}>
              <strong>Linky:</strong> Thinking...
            </p>
          </div>
        )}
        {paymentInProgress && (
          <div style={styles.paymentMessage}>
            <p>Payment in progress, please wait...</p>
          </div>
        )}
      </div>
      <div style={styles.inputContainer}>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Enter your message..."
          style={styles.input}
        />
        <button onClick={sendMessage} style={styles.button} disabled={loading || paymentInProgress}>
          Send
        </button>
        <button onClick={handleClearChat} style={styles.button} disabled={loading || paymentInProgress}>
          Clear Chat
        </button>
      </div>
    </div>
  );
}

export default App;


