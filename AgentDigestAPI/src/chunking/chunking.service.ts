import { Injectable } from '@nestjs/common';

// limit context to 6000 char 
const DEFAULT_CHUNK_SIZE = 6000;
const DEFAULT_OVERLAP = 1200;

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
