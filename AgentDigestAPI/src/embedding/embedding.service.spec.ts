import { Test, TestingModule } from '@nestjs/testing';
import { EmbeddingService } from './embedding.service';

const embedContentMock = jest.fn();

jest.mock('@google/genai', () => ({
  GoogleGenAI: jest.fn().mockImplementation(() => ({
    models: { embedContent: embedContentMock },
  })),
}));

describe('EmbeddingService', () => {
  let service: EmbeddingService;

  beforeEach(async () => {
    embedContentMock.mockReset();

    const module: TestingModule = await Test.createTestingModule({
      providers: [EmbeddingService],
    }).compile();

    service = module.get<EmbeddingService>(EmbeddingService);
  });

  it('returns an empty array for empty input without calling the API', async () => {
    const result = await service.embedText([]);

    expect(result).toEqual([]);
    expect(embedContentMock).not.toHaveBeenCalled();
  });

  it('embeds a batch of texts in a single API call', async () => {
    embedContentMock.mockResolvedValue({
      embeddings: [{ values: [0.1, 0.2] }, { values: [0.3, 0.4] }],
    });

    const result = await service.embedText(['chunk one', 'chunk two']);

    expect(result).toEqual([
      [0.1, 0.2],
      [0.3, 0.4],
    ]);
    expect(embedContentMock).toHaveBeenCalledTimes(1);
    expect(embedContentMock).toHaveBeenCalledWith({
      model: 'gemini-embedding-001',
      contents: ['chunk one', 'chunk two'],
      config: { outputDimensionality: 768 },
    });
  });

  it('returns an empty array when the API responds with no embeddings', async () => {
    embedContentMock.mockResolvedValue({});

    const result = await service.embedText(['chunk one']);

    expect(result).toEqual([]);
  });
});
