import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { IngestionService } from '../ingestion/ingestion.service';
import * as cheerio from 'cheerio';

// Below this, extracted text is almost certainly a bot-check/interstitial
// page rather than real article content (some sites intermittently serve
// these under rapid or repeated requests), not a genuinely short article.
const MIN_CONTENT_LENGTH = 300;

@Injectable()
export class SourcesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ingestion: IngestionService,
  ) {}

  async findAll() {
    return this.prisma.source.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: number) {
    const source = await this.prisma.source.findUnique({ where: { id } });

    if (!source) {
      throw new NotFoundException(`Source with id ${id} not found`);
    }

    return source;
  }

  async create(data: { title?: string; url?: string; content?: string }) {
    const content = data.url
      ? await this.fetchContentFromUrl(data.url)
      : data.content || '';
    const source = await this.prisma.source.create({
      data: {
        title: data.title,
        url: data.url,
        content,
      },
    });
    await this.ingestion.ingest(source.id, content);
    return source;
  }

  async update(
    id: number,
    data: { title?: string; url?: string; content?: string },
  ) {
    await this.findOne(id);

    const content = data.url
      ? await this.fetchContentFromUrl(data.url)
      : data.content || '';
    const source = await this.prisma.source.update({
      where: { id },
      data: {
        title: data.title,
        url: data.url,
        content,
      },
    });
    await this.ingestion.ingest(source.id, content);
    return source;
  }

  async remove(id: number) {
    await this.findOne(id);

    return this.prisma.source.delete({ where: { id } });
  }

  private async fetchContentFromUrl(url: string): Promise<string> {
    let extracted: string;
    try {
      // get the content of the URL using fetch and parse it with cheerio
      const response = await fetch(url);
      const html = await response.text();
      const $ = cheerio.load(html);
      $('script, style, noscript, nav, footer, header, iframe').remove();
      extracted = $('body').text().replace(/\s+/g, ' ').trim();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to fetch content from URL: ${message}`);
    }

    if (extracted.length < MIN_CONTENT_LENGTH) {
      throw new Error(
        'The page returned unexpectedly little content — it may be ' +
          'blocking automated requests. Wait a moment and try again.',
      );
    }

    return extracted;
  }
}
