import { Injectable } from '@nestjs/common';
import { GoogleGenAI } from '@google/genai';

@Injectable()
export class ChatService {
  private readonly ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

  async sendMessage(message: string): Promise<string> {
    const response = await this.ai.models.generateContent({
      model: 'gemini-flash-latest',
      contents: message,
    });
    return response.text ?? '';
  }
}