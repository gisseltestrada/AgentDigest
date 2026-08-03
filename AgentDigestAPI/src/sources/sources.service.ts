import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SourcesService {
  constructor(private readonly prisma: PrismaService) {}

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

  async create(data: { title?: string; url?: string }) {
    return this.prisma.source.create({
      data: {
        title: data.title,
        url: data.url,
      },
    });
  }

  async update(id: number, data: { title?: string; url?: string }) {
    await this.findOne(id);

    return this.prisma.source.update({
      where: { id },
      data: {
        title: data.title,
        url: data.url,
      },
    });
  }

  async remove(id: number) {
    await this.findOne(id);

    return this.prisma.source.delete({ where: { id } });
  }
}
