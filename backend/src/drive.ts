// src/drive.ts
import { createAutoDriveApi, uploadFile, downloadFile } from '@autonomys/auto-drive';
import dotenv from 'dotenv';

dotenv.config(); 

const api = createAutoDriveApi({ apiKey: process.env.AUTODRIVE_API_KEY! });

/**
 * Upload user chat records to Auto Drive
 * @param chatRecords The full chat record buffer
 * @param filename The name of the file to be uploaded
 * @param password Optional encryption password
 * @param userId The ID of the user (UUID or wallet address)
 * @returns The CID of the uploaded file
 */
export async function uploadFileFromMemory(
  chatRecords: { [key: string]: { messages: string[] } },
  filename: string,
  password: string,
  userId: string
): Promise<string> {
  if (!userId.startsWith("0x")) {
    throw new Error("Wallet connection required to upload files.");
  }

  const userChat = chatRecords[userId];
  if (!userChat) {
    throw new Error(`No chat records found for userId: ${userId}`);
  }

  const content = {
    userId,
    messages: userChat.messages,
    timestamp: new Date().toISOString(),
  };

  const buffer = Buffer.from(JSON.stringify(content, null, 2), 'utf-8');
  const genericFile = {
    read: async function* () { yield buffer; },
    name: filename,
    mimeType: 'application/json',
    size: buffer.length,
    path: filename,
  };

  const options = {
    password,
    compression: true,
    onProgress: (progress: number) => console.log(`Upload progress: ${progress}%`),
  };

  try {
    const cid = await uploadFile(api, genericFile, options);
    return cid;
  } catch (error) {
    console.error('Upload failed:', error);
    throw error;
  }
}

/**
 * Download a file from Auto Drive
 * @param cid The CID of the file
 * @param password Optional decryption password
 * @returns The file content as a Buffer, JSON, or string
 */
export async function downloadFileFromAutoDrive(
  cid: string,
  password?: string
): Promise<object | string | Buffer> {
  try {
    const stream = await downloadFile(api, cid, password);
    let fileBuffer = Buffer.alloc(0);

    for await (const chunk of stream) {
      fileBuffer = Buffer.concat([fileBuffer, chunk]);
    }

    // Try Json
    try {
      const jsonContent = JSON.parse(fileBuffer.toString('utf-8'));
      return jsonContent; // If successful, return Json
    } catch (jsonError) {
      console.warn("File is not JSON, attempting to parse as text.");
    }

    // Try txt
    const textContent = fileBuffer.toString('utf-8');
    if (/^[\x20-\x7E\s\u00A0-\uFFFF]+$/.test(textContent)) { // 
      return textContent;
    }

    // Return buffer otherwise
    return fileBuffer;
  } catch (error) {
    console.error("Download failed:", error);
    throw error;
  }
}
