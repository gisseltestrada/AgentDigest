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

  it('falls back to a plain prompt when there are no chunks in the library', async () => {
    embedding.embedText.mockResolvedValue([[0.1, 0.2]]);
    prisma.$queryRaw.mockResolvedValue([]);
    generateContentMock.mockResolvedValue({ text: 'I have no sources yet.' });

    const result = await service.sendMessage('question');

    expect(generateContentMock).toHaveBeenCalledWith({
      model: 'gemini-3.6-flash',
      contents: 'question',
    });
    expect(result.citations).toEqual([]);
  });
});
