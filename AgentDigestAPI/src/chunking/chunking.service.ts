import { Injectable } from '@nestjs/common';

const DEFAULT_CHUNK_SIZE = 1000;
const DEFAULT_OVERLAP = 200;

@Injectable()
export class ChunkingService {

  chunkText(
    text: string,
    chunkSize: number = DEFAULT_CHUNK_SIZE,
    overlap: number = DEFAULT_OVERLAP,
  ): string[] {
    if (overlap >= chunkSize) {
      throw new Error('overlap must be smaller than chunkSize');
    }

    if (!text) {
      return [];
    }

    const chunks: string[] = [];
    let start = 0;

    while (start < text.length) {
      const end = Math.min(start + chunkSize, text.length);
      chunks.push(text.slice(start, end));

      if (end === text.length) {
        break;
      }

      start += chunkSize - overlap;
    }

    return chunks;
  }
  
}
