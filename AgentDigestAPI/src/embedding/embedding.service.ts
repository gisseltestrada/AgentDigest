import { Injectable } from '@nestjs/common';
import { GoogleGenAI } from '@google/genai';

const EMBEDDING_MODEL = 'text-embedding-004';

@Injectable()
export class EmbeddingService {
  private readonly ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

  async embedText(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) {
      return [];
    }

    const response = await this.ai.models.embedContent({
      model: EMBEDDING_MODEL,
      contents: texts,
    });

    return (response.embeddings ?? []).map((embedding) => embedding.values ?? []);
  }
}
