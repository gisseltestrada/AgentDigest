import { Test, TestingModule } from '@nestjs/testing';
import { IngestionService } from './ingestion.service';
import { PrismaService } from '../prisma/prisma.service';
import { ChunkingService } from '../chunking/chunking.service';
import { EmbeddingService } from '../embedding/embedding.service';

describe('IngestionService', () => {
  let service: IngestionService;
  let prisma: any;
  let chunking: any;
  let embedding: any;

  beforeEach(async () => {
    prisma = {
      chunk: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
      $executeRaw: jest.fn().mockResolvedValue(1),
      $transaction: jest.fn((ops: unknown[]) => Promise.all(ops)),
    };
    chunking = { chunkText: jest.fn() };
    embedding = { embedText: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IngestionService,
        { provide: PrismaService, useValue: prisma },
        { provide: ChunkingService, useValue: chunking },
        { provide: EmbeddingService, useValue: embedding },
      ],
    }).compile();

    service = module.get<IngestionService>(IngestionService);
  });

  it('deletes stale chunks and inserts fresh ones inside a single transaction', async () => {
    chunking.chunkText.mockReturnValue(['chunk one', 'chunk two']);
    embedding.embedText.mockResolvedValue([
      [0.1, 0.2],
      [0.3, 0.4],
    ]);

    await service.ingest(1, 'full source content');

    expect(chunking.chunkText).toHaveBeenCalledWith('full source content');
    expect(embedding.embedText).toHaveBeenCalledWith([
      'chunk one',
      'chunk two',
    ]);
    expect(prisma.chunk.deleteMany).toHaveBeenCalledWith({
      where: { sourceId: 1 },
    });
    expect(prisma.$executeRaw).toHaveBeenCalledTimes(2);
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });

  it('clears stale chunks without calling the embedding API when there is nothing to chunk', async () => {
    chunking.chunkText.mockReturnValue([]);

    await service.ingest(1, '');

    expect(embedding.embedText).not.toHaveBeenCalled();
    expect(prisma.chunk.deleteMany).toHaveBeenCalledWith({
      where: { sourceId: 1 },
    });
    expect(prisma.$executeRaw).not.toHaveBeenCalled();
  });
});
