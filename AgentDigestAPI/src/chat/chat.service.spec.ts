import { Test, TestingModule } from '@nestjs/testing';
import { ChatService } from './chat.service';
import { PrismaService } from '../prisma/prisma.service';
import { EmbeddingService } from '../embedding/embedding.service';

const generateContentMock = jest.fn();

jest.mock('@google/genai', () => ({
  GoogleGenAI: jest.fn().mockImplementation(() => ({
    models: { generateContent: generateContentMock },
  })),
}));

describe('ChatService', () => {
  let service: ChatService;
  let prisma: any;
  let embedding: any;

  beforeEach(async () => {
    generateContentMock.mockReset();
    prisma = { $queryRaw: jest.fn() };
    embedding = { embedText: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChatService,
        { provide: PrismaService, useValue: prisma },
        { provide: EmbeddingService, useValue: embedding },
      ],
    }).compile();

    service = module.get<ChatService>(ChatService);
  });

  it('retrieves relevant chunks and includes them as context and citations', async () => {
    embedding.embedText.mockResolvedValue([[0.1, 0.2]]);
    prisma.$queryRaw.mockResolvedValue([
      {
        content: 'Paris is the capital of France.',
        sourceId: 1,
        title: 'Geography 101',
        url: 'https://example.com/geo',
      },
    ]);
    generateContentMock.mockResolvedValue({ text: 'Paris.' });

    const result = await service.sendMessage('What is the capital of France?');

    expect(embedding.embedText).toHaveBeenCalledWith([
      'What is the capital of France?',
    ]);
    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
    expect(generateContentMock).toHaveBeenCalledTimes(1);
    const call = generateContentMock.mock.calls[0][0];
    expect(call.contents).toContain('Paris is the capital of France.');
    expect(call.contents).toContain('What is the capital of France?');
    expect(result).toEqual({
      reply: 'Paris.',
      citations: [
        { sourceId: 1, title: 'Geography 101', url: 'https://example.com/geo' },
      ],
    });
  });

  it('deduplicates citations from multiple chunks of the same source', async () => {
    embedding.embedText.mockResolvedValue([[0.1, 0.2]]);
    prisma.$queryRaw.mockResolvedValue([
      { content: 'chunk a', sourceId: 1, title: 'Doc', url: null },
      { content: 'chunk b', sourceId: 1, title: 'Doc', url: null },
    ]);
    generateContentMock.mockResolvedValue({ text: 'Answer.' });

    const result = await service.sendMessage('question');

    expect(result.citations).toEqual([{ sourceId: 1, title: 'Doc', url: null }]);
  });

  it('instructs the model to refuse rather than answer from general knowledge when nothing matches', async () => {
    embedding.embedText.mockResolvedValue([[0.1, 0.2]]);
    prisma.$queryRaw.mockResolvedValue([]);
    generateContentMock.mockResolvedValue({
      text: "I don't have any saved sources covering that.",
    });

    const result = await service.sendMessage('question');

    const call = generateContentMock.mock.calls[0][0];
    expect(call.model).toBe('gemini-3.6-flash');
    expect(call.contents).toContain('do not answer from your own general knowledge');
    expect(call.contents).toContain('question');
    expect(result.citations).toEqual([]);
  });
});
