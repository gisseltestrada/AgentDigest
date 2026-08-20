import { Injectable } from '@nestjs/common';
import { GoogleGenAI } from '@google/genai';
import { PrismaService } from '../prisma/prisma.service';
import { EmbeddingService } from '../embedding/embedding.service';

// Pinned rather than the "-latest" alias: that alias has been returning
// sustained 503 UNAVAILABLE ("high demand") for this API key/project,
// while this pinned version responds normally.
const CHAT_MODEL = 'gemini-3.6-flash';
const TOP_K = 5;
// Cosine distance ranges 0 (identical) to 2 (opposite); chunks farther than
// this are treated as irrelevant rather than force-fed into the prompt.
const MAX_DISTANCE = 0.4;

interface RetrievedChunk {
  content: string;
  sourceId: number;
  title: string | null;
  url: string | null;
}

export interface Citation {
  sourceId: number;
  title: string | null;
  url: string | null;
}

export interface ChatReply {
  reply: string;
  citations: Citation[];
}

@Injectable()
export class ChatService {
  private readonly ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

  constructor(
    private readonly prisma: PrismaService,
    private readonly embedding: EmbeddingService,
  ) {}

  async sendMessage(message: string): Promise<ChatReply> {
    const [questionVector] = await this.embedding.embedText([message]);
    const chunks = questionVector
      ? await this.retrieveRelevantChunks(questionVector)
      : [];

    const response = await this.ai.models.generateContent({
      model: CHAT_MODEL,
      contents: this.buildPrompt(message, chunks),
    });

    return {
      reply: response.text ?? '',
      citations: this.dedupeCitations(chunks),
    };
  }

  private async retrieveRelevantChunks(
    vector: number[],
  ): Promise<RetrievedChunk[]> {
    const vectorLiteral = `[${vector.join(',')}]`;

    return this.prisma.$queryRaw<RetrievedChunk[]>`
      SELECT content, "sourceId", title, url FROM (
        SELECT c.content, c."sourceId", s.title, s.url,
               c.embedding <=> ${vectorLiteral}::vector AS distance
        FROM "Chunk" c
        JOIN "Source" s ON s.id = c."sourceId"
        ORDER BY distance ASC
        LIMIT ${TOP_K}
      ) nearest
      WHERE distance < ${MAX_DISTANCE}
    `;
  }

  private buildPrompt(message: string, chunks: RetrievedChunk[]): string {
    if (chunks.length === 0) {
      return (
        `No saved source is relevant to this question. Tell the user you ` +
        `don't have any saved sources covering this — do not answer from ` +
        `your own general knowledge.\n\nQuestion: ${message}`
      );
    }

    const context = chunks
      .map((chunk, i) => `[${i + 1}] ${chunk.content}`)
      .join('\n\n');

    return (
      `Answer the question using only the context below. ` +
      `If the context doesn't contain the answer, say you don't know.\n\n` +
      `Context:\n${context}\n\nQuestion: ${message}`
    );
  }

  private dedupeCitations(chunks: RetrievedChunk[]): Citation[] {
    const bySourceId = new Map<number, Citation>();
    for (const chunk of chunks) {
      if (!bySourceId.has(chunk.sourceId)) {
        bySourceId.set(chunk.sourceId, {
          sourceId: chunk.sourceId,
          title: chunk.title,
          url: chunk.url,
        });
      }
    }
    return [...bySourceId.values()];
  }
}
