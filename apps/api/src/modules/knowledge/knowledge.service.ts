import {
  ConflictException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateKnowledgePostDto } from './dto/create-knowledge-post.dto';
import { UpdateKnowledgePostDto } from './dto/update-knowledge-post.dto';
import { QueryKnowledgePostsDto } from './dto/query-knowledge-posts.dto';
import { Prisma } from '../../generated/client/client';
import { KnowledgeStatus } from '../../generated/client/enums';
import { StorageService } from '../../common/storage/storage.service';
import { KnowledgeAttachmentDto } from './dto/knowledge-attachment.dto';
import {
  KNOWLEDGE_ATTACHMENT_MAX_BYTES,
  KNOWLEDGE_IMAGE_MAX_BYTES,
} from './knowledge.constants';

@Injectable()
export class KnowledgeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storageService: StorageService,
  ) {}

  async findAll(query: QueryKnowledgePostsDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 12;
    const skip = (page - 1) * limit;
    const normalizedSearch = query.search?.trim();
    const normalizedTerms = normalizedSearch
      ? normalizedSearch
          .split(/[,\s]+/)
          .map((term) => term.trim().toLowerCase())
          .filter(Boolean)
      : [];

    const where: Prisma.KnowledgePostWhereInput = {
      ...(query.category ? { category: query.category } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.priority ? { priority: query.priority } : {}),
      ...(normalizedSearch
        ? {
            OR: [
              {
                title: {
                  contains: normalizedSearch,
                  mode: 'insensitive',
                },
              },
              {
                summary: {
                  contains: normalizedSearch,
                  mode: 'insensitive',
                },
              },
              {
                content: {
                  contains: normalizedSearch,
                  mode: 'insensitive',
                },
              },
              ...(normalizedTerms.length > 0
                ? [
                    {
                      tags: {
                        hasSome: normalizedTerms,
                      },
                    },
                  ]
                : []),
            ],
          }
        : {}),
    };

    try {
      const [items, total] = await this.prisma.$transaction([
        this.prisma.knowledgePost.findMany({
          where,
          include: {
            author: {
              select: {
                id: true,
                email: true,
                role: true,
              },
            },
          },
          orderBy: [
            { priority: 'desc' },
            { updatedAt: 'desc' },
            { createdAt: 'desc' },
          ],
          skip,
          take: limit,
        }),
        this.prisma.knowledgePost.count({ where }),
      ]);

      return {
        items,
        total,
        page,
        limit,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      };
    } catch (error) {
      this.throwIfKnowledgeStorageUnavailable(error);
      throw error;
    }
  }

  async findOne(id: string) {
    try {
      const post = await this.prisma.knowledgePost.findUnique({
        where: { id },
        include: {
          author: {
            select: {
              id: true,
              email: true,
              role: true,
            },
          },
        },
      });

      if (!post) {
        throw new NotFoundException(`Knowledge post with ID ${id} not found`);
      }

      return post;
    } catch (error) {
      this.throwIfKnowledgeStorageUnavailable(error);
      throw error;
    }
  }

  async create(dto: CreateKnowledgePostDto, userId?: string) {
    try {
      return await this.prisma.knowledgePost.create({
        data: {
          title: dto.title.trim(),
          slug: this.resolveSlug(dto.slug, dto.title),
          summary: dto.summary?.trim() || null,
          content: dto.content.trim(),
          imageUrls: this.normalizeImageUrls(dto.imageUrls),
          attachments: this.normalizeAttachments(dto.attachments),
          category: dto.category,
          status: dto.status,
          priority: dto.priority,
          tags: this.normalizeTags(dto.tags),
          authorId: dto.authorId ?? userId ?? null,
          publishedAt: this.resolvePublishedAt({
            explicitPublishedAt: dto.publishedAt,
            nextStatus: dto.status,
          }),
        },
        include: {
          author: {
            select: {
              id: true,
              email: true,
              role: true,
            },
          },
        },
      });
    } catch (error) {
      this.throwIfKnowledgeStorageUnavailable(error);
      this.handlePrismaError(error, dto.slug ?? dto.title);
      throw error;
    }
  }

  async update(id: string, dto: UpdateKnowledgePostDto, userId?: string) {
    let existingPost: {
      id: string;
      title: string;
      slug: string;
      status: KnowledgeStatus;
      publishedAt: Date | null;
      authorId: string | null;
    } | null = null;

    try {
      existingPost = await this.prisma.knowledgePost.findUnique({
        where: { id },
        select: {
          id: true,
          title: true,
          slug: true,
          status: true,
          publishedAt: true,
          authorId: true,
        },
      });
    } catch (error) {
      this.throwIfKnowledgeStorageUnavailable(error);
      throw error;
    }

    if (!existingPost) {
      throw new NotFoundException(`Knowledge post with ID ${id} not found`);
    }

    try {
      return await this.prisma.knowledgePost.update({
        where: { id },
        data: {
          ...(dto.title !== undefined ? { title: dto.title.trim() } : {}),
          ...(dto.slug !== undefined || dto.title !== undefined
            ? {
                slug: this.resolveSlug(
                  dto.slug ?? existingPost.slug,
                  dto.title ?? existingPost.title,
                ),
              }
            : {}),
          ...(dto.summary !== undefined
            ? { summary: dto.summary?.trim() || null }
            : {}),
          ...(dto.content !== undefined ? { content: dto.content.trim() } : {}),
          ...(dto.imageUrls !== undefined
            ? { imageUrls: this.normalizeImageUrls(dto.imageUrls) }
            : {}),
          ...(dto.attachments !== undefined
            ? { attachments: this.normalizeAttachments(dto.attachments) }
            : {}),
          ...(dto.category !== undefined ? { category: dto.category } : {}),
          ...(dto.status !== undefined ? { status: dto.status } : {}),
          ...(dto.priority !== undefined ? { priority: dto.priority } : {}),
          ...(dto.tags !== undefined
            ? { tags: this.normalizeTags(dto.tags) }
            : {}),
          ...(dto.authorId !== undefined
            ? { authorId: dto.authorId || null }
            : existingPost.authorId
              ? {}
              : { authorId: userId ?? null }),
          publishedAt: this.resolvePublishedAt({
            explicitPublishedAt: dto.publishedAt,
            nextStatus: dto.status ?? existingPost.status,
            currentPublishedAt: existingPost.publishedAt,
          }),
        },
        include: {
          author: {
            select: {
              id: true,
              email: true,
              role: true,
            },
          },
        },
      });
    } catch (error) {
      this.throwIfKnowledgeStorageUnavailable(error);
      this.handlePrismaError(error, dto.slug ?? existingPost.slug);
      throw error;
    }
  }

  async remove(id: string) {
    try {
      await this.prisma.knowledgePost.delete({
        where: { id },
      });
    } catch (error) {
      this.throwIfKnowledgeStorageUnavailable(error);
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        throw new NotFoundException(`Knowledge post with ID ${id} not found`);
      }

      throw error;
    }
  }

  async uploadImage(file: Express.Multer.File) {
    this.validateImageFile(file);

    const normalizedName = file.originalname
      .trim()
      .replace(/\s+/g, '-')
      .replace(/[^a-zA-Z0-9._-]/g, '');
    const path = `knowledge-posts/${Date.now()}-${normalizedName}`;
    const publicUrl = await this.storageService.uploadFile(
      'product-assets',
      path,
      file,
    );

    return { url: publicUrl, path };
  }

  async uploadAttachment(file: Express.Multer.File) {
    this.validateAttachmentFile(file);

    const normalizedName = file.originalname
      .trim()
      .replace(/\s+/g, '-')
      .replace(/[^a-zA-Z0-9._-]/g, '');
    const path = `knowledge-posts/attachments/${Date.now()}-${normalizedName}`;
    const publicUrl = await this.storageService.uploadFile(
      'product-assets',
      path,
      file,
    );

    return {
      name: file.originalname,
      url: publicUrl,
      mimeType: file.mimetype,
      size: file.size,
    };
  }

  private resolveSlug(slug: string | undefined, title: string) {
    const rawValue = slug?.trim() || title.trim();

    return rawValue
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9\s-]/g, '')
      .trim()
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-');
  }

  private normalizeTags(tags: string[] | undefined) {
    if (!Array.isArray(tags)) {
      return [];
    }

    return Array.from(
      new Set(
        tags
          .map((tag) => tag.trim().toLowerCase())
          .filter((tag) => tag.length > 0),
      ),
    );
  }

  private normalizeImageUrls(imageUrls: string[] | undefined) {
    if (!Array.isArray(imageUrls)) {
      return [];
    }

    return Array.from(
      new Set(
        imageUrls
          .map((value) => value.trim())
          .filter((value) => value.length > 0),
      ),
    );
  }

  private normalizeAttachments(
    attachments: KnowledgeAttachmentDto[] | undefined,
  ): Prisma.JsonArray {
    if (!Array.isArray(attachments)) {
      return [];
    }

    return attachments.map((attachment) => ({
      name: attachment.name.trim(),
      url: attachment.url.trim(),
      ...(attachment.mimeType?.trim()
        ? { mimeType: attachment.mimeType.trim() }
        : {}),
      ...(typeof attachment.size === 'number' ? { size: attachment.size } : {}),
    }));
  }

  private resolvePublishedAt(options: {
    explicitPublishedAt?: string | null;
    nextStatus?: KnowledgeStatus;
    currentPublishedAt?: Date | null;
  }) {
    if (options.explicitPublishedAt !== undefined) {
      return options.explicitPublishedAt
        ? new Date(options.explicitPublishedAt)
        : null;
    }

    if (
      options.nextStatus === KnowledgeStatus.PUBLICADO &&
      !options.currentPublishedAt
    ) {
      return new Date();
    }

    return options.currentPublishedAt ?? null;
  }

  private handlePrismaError(error: unknown, slugOrTitle: string) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      throw new ConflictException(
        `A knowledge post with slug "${slugOrTitle}" already exists`,
      );
    }
  }

  private validateImageFile(file: Express.Multer.File | undefined) {
    if (!file) {
      throw new BadRequestException('Debes seleccionar una imagen para subir.');
    }

    if (file.size < 1) {
      throw new BadRequestException('El archivo de imagen esta vacio.');
    }

    if (file.size > KNOWLEDGE_IMAGE_MAX_BYTES) {
      throw new BadRequestException(
        'La imagen excede el limite permitido de 10 MB.',
      );
    }

    if (!file.mimetype.startsWith('image/')) {
      throw new BadRequestException('Solo se permiten archivos de imagen.');
    }
  }

  private validateAttachmentFile(file: Express.Multer.File | undefined) {
    if (!file) {
      throw new BadRequestException('Debes seleccionar un archivo para subir.');
    }

    if (file.size < 1) {
      throw new BadRequestException('El archivo adjunto esta vacio.');
    }

    if (file.size > KNOWLEDGE_ATTACHMENT_MAX_BYTES) {
      throw new BadRequestException(
        'El archivo adjunto excede el limite permitido de 25 MB.',
      );
    }

    const allowedMimeTypes = new Set([
      'application/pdf',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/msword',
      'text/csv',
      'text/plain',
      'application/zip',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'application/vnd.ms-powerpoint',
      'image/png',
      'image/jpeg',
      'image/webp',
    ]);

    if (!allowedMimeTypes.has(file.mimetype)) {
      throw new BadRequestException(
        'Tipo de archivo no permitido. Usa PDF, Excel, Word, CSV, ZIP, PowerPoint o imagenes.',
      );
    }
  }

  private throwIfKnowledgeStorageUnavailable(error: unknown) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      (error.code === 'P2021' || error.code === 'P2022')
    ) {
      throw new ServiceUnavailableException(
        'El modulo Centro Informativo requiere ejecutar la migracion pendiente en la base de datos.',
      );
    }
  }
}
