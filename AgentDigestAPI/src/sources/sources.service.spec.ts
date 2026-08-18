import { Test, TestingModule } from '@nestjs/testing';
import { SourcesService } from './sources.service';
import { PrismaService } from '../prisma/prisma.service';
import { IngestionService } from '../ingestion/ingestion.service';

describe('SourcesService', () => {
  let service: SourcesService;
  let prisma: any;
  let ingestion: any;

  beforeEach(async () => {
    prisma = {
      source: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
    };
    ingestion = { ingest: jest.fn().mockResolvedValue(undefined) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SourcesService,
        { provide: PrismaService, useValue: prisma },
        { provide: IngestionService, useValue: ingestion },
      ],
    }).compile();

    service = module.get<SourcesService>(SourcesService);
  });

  it('creates a source', async () => {
    prisma.source.create.mockResolvedValue({
      id: 1,
      title: 'Test source',
      content: 'Some article content',
    });

    const result = await service.create({
      title: 'Test source',
      content: 'Some article content',
    });

    expect(result.title).toBe('Test source');
    expect(prisma.source.create).toHaveBeenCalledWith({
      data: {
        title: 'Test source',
        url: undefined,
        content: 'Some article content',
      },
    });
    expect(ingestion.ingest).toHaveBeenCalledWith(1, 'Some article content');
  });
});
