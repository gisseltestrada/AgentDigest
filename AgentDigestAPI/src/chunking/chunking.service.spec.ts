import { Test, TestingModule } from '@nestjs/testing';
import { ChunkingService } from './chunking.service';

describe('ChunkingService', () => {
  let service: ChunkingService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ChunkingService],
    }).compile();

    service = module.get<ChunkingService>(ChunkingService);
  });

  it('returns an empty array for empty text', () => {
    expect(service.chunkText('')).toEqual([]);
  });

  it('returns a single chunk when text is shorter than chunkSize', () => {
    const text = 'hello world';
    expect(service.chunkText(text, 1000, 200)).toEqual([text]);
  });

  it('splits long text into multiple chunks', () => {
    const text = 'a'.repeat(2500);
    const chunks = service.chunkText(text, 1000, 200);

    expect(chunks.length).toBe(3);
    expect(chunks[0].length).toBe(1000);
    expect(chunks[chunks.length - 1].length).toBeLessThanOrEqual(1000);
  });

  it('overlaps consecutive chunks by the given amount', () => {
    const text = 'abcdefghij'.repeat(50); // 500 chars
    const chunkSize = 100;
    const overlap = 20;
    const chunks = service.chunkText(text, chunkSize, overlap);

    for (let i = 0; i < chunks.length - 1; i++) {
      const endOfCurrent = chunks[i].slice(-overlap);
      const startOfNext = chunks[i + 1].slice(0, overlap);
      expect(startOfNext).toBe(endOfCurrent);
    }
  });

  it('reconstructs full coverage of the original text with no gaps', () => {
    const text = 'x'.repeat(2137);
    const chunkSize = 300;
    const overlap = 50;
    const chunks = service.chunkText(text, chunkSize, overlap);

    const last = chunks[chunks.length - 1];
    const totalCovered =
      (chunks.length - 1) * (chunkSize - overlap) + last.length;
    expect(totalCovered).toBe(text.length);
  });

  it('throws if overlap is not smaller than chunkSize', () => {
    expect(() => service.chunkText('some text', 100, 100)).toThrow();
  });
});
