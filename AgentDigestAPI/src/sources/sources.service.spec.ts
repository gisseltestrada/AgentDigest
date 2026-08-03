import { Test, TestingModule } from '@nestjs/testing';
import { SourcesService } from './sources.service';
import { PrismaService } from '../prisma/prisma.service';

describe('SourcesService', () => {
  let service: SourcesService;
  let prisma: any;

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

    const module: TestingModule = await Test.createTestingModule({
      providers: [SourcesService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get<SourcesService>(SourcesService);
  });

  it('creates a source', async () => {
    prisma.source.create.mockResolvedValue({ id: 1, title: 'Test source', url: 'https://example.com' });

    const result = await service.create({ title: 'Test source', url: 'https://example.com' });

    expect(result.title).toBe('Test source');
    expect(prisma.source.create).toHaveBeenCalledWith({
      data: { title: 'Test source', url: 'https://example.com' },
    });
  });
});
