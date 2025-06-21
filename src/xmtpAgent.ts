import { Client } from '@xmtp/xmtp-js';
import dotenv from 'dotenv';

dotenv.config();

export class XMTPAgent {
  private clients: Map<string, Client> = new Map();

  constructor() {}

  async initialize(walletAddress: string, signature: string) {
    if (this.clients.has(walletAddress)) {
      return this.clients.get(walletAddress)!;
    }

    try {
      // Create a signer from the signature that can be used for XMTP
      const signer = {
        getAddress: () => Promise.resolve(walletAddress),
        signMessage: async (message: string) => {
          // Return cached signature for the XMTP identity
          return signature;
        }
      };

      const client = await Client.create(signer, { env: process.env.XMTP_ENV as any });
      this.clients.set(walletAddress, client);
      return client;
    } catch (error) {
      console.error('Failed to initialize XMTP client:', error);
      return null;
    }
  }  async sendAlert(senderAddress: string, recipientAddress: string, message: string) {
    try {
      const client = this.clients.get(senderAddress);
      if (!client) {
        console.warn('Cannot send XMTP alert: client not initialized for address', senderAddress);
        return false;
      }

      const conversation = await client.conversations.newConversation(recipientAddress);
      await conversation.send(message);
      return true;
    } catch (error) {
      console.error('Error sending XMTP message:', error);
      return false;
    }
  }

  async startStreamingMessages(walletAddress: string, callback: (message: any) => void) {
    const client = this.clients.get(walletAddress);
    if (!client) {
      console.warn('Cannot stream XMTP messages: client not initialized for address', walletAddress);
      return;
    }
    
    try {
      for await (const message of await client.conversations.streamAllMessages()) {
        callback(message);
      }
    } catch (error) {
      console.error('Error streaming XMTP messages:', error);
    }
  }

  async canMessage(walletAddress: string, recipientAddress: string): Promise<boolean> {
    const client = this.clients.get(walletAddress);
    if (!client) {
      return false;
    }

    try {
      const canMessage = await client.canMessage(recipientAddress);
      return canMessage;
    } catch (error) {
      console.error('Error checking if can message:', error);
      return false;
    }
  }
}
