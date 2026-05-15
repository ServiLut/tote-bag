import { BadRequestException } from '@nestjs/common';
import { KnowledgeStatus } from '../../generated/client/enums';
import { KnowledgeService } from './knowledge.service';
import {
  KNOWLEDGE_ATTACHMENT_MAX_BYTES,
  KNOWLEDGE_IMAGE_MAX_BYTES,
} from './knowledge.constants';

describe('KnowledgeService', () => {
  const prisma = {
    knowledgePost: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  };

  const storageService = {
    uploadFile: jest.fn(),
  };

  let service: KnowledgeService;

  beforeEach(() => {
    jest.resetAllMocks();
    service = new KnowledgeService(prisma as never, storageService as never);
  });

  it('clears publishedAt when an edited post sends null explicitly', async () => {
    prisma.knowledgePost.findUnique.mockResolvedValue({
      id: 'post-1',
      title: 'Post actual',
      slug: 'post-actual',
      status: KnowledgeStatus.PUBLICADO,
      publishedAt: new Date('2026-05-05T10:00:00.000Z'),
      authorId: 'author-1',
    });
    prisma.knowledgePost.update.mockResolvedValue({
      id: 'post-1',
      publishedAt: null,
    });

    await service.update(
      'post-1',
      {
        publishedAt: null,
      } as never,
      'user-1',
    );

    expect(prisma.knowledgePost.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          publishedAt: null,
        }) as unknown,
      }),
    );
  });

  it('rejects oversized images before uploading them', () => {
    expect(() =>
      (
        service as unknown as {
          validateImageFile: (file: Express.Multer.File) => void;
        }
      ).validateImageFile({
        size: KNOWLEDGE_IMAGE_MAX_BYTES + 1,
        mimetype: 'image/png',
      } as Express.Multer.File),
    ).toThrow(BadRequestException);
  });

  it('rejects oversized attachments before uploading them', () => {
    expect(() =>
      (
        service as unknown as {
          validateAttachmentFile: (file: Express.Multer.File) => void;
        }
      ).validateAttachmentFile({
        size: KNOWLEDGE_ATTACHMENT_MAX_BYTES + 1,
        mimetype:
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      } as Express.Multer.File),
    ).toThrow(BadRequestException);
  });
});
