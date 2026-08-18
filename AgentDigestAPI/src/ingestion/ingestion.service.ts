import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ChunkingService } from '../chunking/chunking.service';
import { EmbeddingService } from '../embedding/embedding.service';

@Injectable()
export class IngestionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly chunking: ChunkingService,
    private readonly embedding: EmbeddingService,
  ) {}

  async ingest(sourceId: number, content: string): Promise<void> {
    const chunks = this.chunking.chunkText(content);
    const vectors =
      chunks.length > 0 ? await this.embedding.embedText(chunks) : [];

    await this.prisma.$transaction([
      // delete stale chunks for this sourceId before inserting new ones
      this.prisma.chunk.deleteMany({ where: { sourceId } }),
      ...chunks.map((chunkContent, i) => {
        const vectorLiteral = `[${vectors[i].join(',')}]`;
        // insert new chunk with embedding using raw SQL to cast the array to a vector type
        return this.prisma.$executeRaw`
          INSERT INTO "Chunk" (content, embedding, "sourceId")
          VALUES (${chunkContent}, ${vectorLiteral}::vector, ${sourceId})
        `;
      }),
    ]);
  }
}
