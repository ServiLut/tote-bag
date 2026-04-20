import {
  Injectable,
  InternalServerErrorException,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient } from '@supabase/supabase-js';
import { Prisma } from '../../generated/client/client';
import { PrismaService } from '../../prisma/prisma.service';
import { SignedUploadPayload } from './storage.types';

@Injectable()
export class StorageService implements OnModuleInit, OnModuleDestroy {
  private supabase: ReturnType<typeof createClient>;
  private readonly ensuredBuckets = new Set<string>();
  private readonly logger = new Logger(StorageService.name);
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    const supabaseUrl =
      this.configService.get<string>('auth.supabaseUrl') ||
      this.configService.get<string>('SUPABASE_URL') ||
      this.configService.get<string>('NEXT_PUBLIC_SUPABASE_URL');
    const supabaseKey =
      this.configService.get<string>('SERVICE_ROLE') ||
      this.configService.get<string>('SUPABASE_KEY') ||
      this.configService.get<string>('NEXT_PUBLIC_SUPABASE_ANON_KEY');

    if (!supabaseUrl || !supabaseKey) {
      throw new Error(
        'Supabase URL or Key is missing in environment variables.',
      );
    }

    this.supabase = createClient(supabaseUrl, supabaseKey);
  }

  onModuleInit() {
    const cleanupEnabled =
      this.configService.get<string>('NODE_ENV') !== 'test';

    if (!cleanupEnabled) {
      return;
    }

    this.cleanupInterval = setInterval(
      () => {
        void this.cleanupStaleCustomDesignUploads().catch((error) => {
          this.logger.error('Deferred custom design cleanup failed', error);
        });
      },
      6 * 60 * 60 * 1000,
    );
  }

  onModuleDestroy() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }

  async uploadFile(
    bucket: string,
    path: string,
    file: Express.Multer.File,
  ): Promise<string> {
    await this.ensureBucket(bucket, true);

    const { error } = await this.supabase.storage
      .from(bucket)
      .upload(path, file.buffer, {
        contentType: file.mimetype,
        upsert: true,
      });

    if (error) {
      console.error('Supabase Upload Error:', error);
      throw new InternalServerErrorException(
        error.message || `Error uploading file to ${bucket}`,
      );
    }

    const { data: publicUrlData } = this.supabase.storage
      .from(bucket)
      .getPublicUrl(path);

    return publicUrlData.publicUrl;
  }

  async uploadPrivateFile(
    bucket: string,
    path: string,
    file: Express.Multer.File,
  ) {
    await this.ensureBucket(bucket, false);

    const { error } = await this.supabase.storage
      .from(bucket)
      .upload(path, file.buffer, {
        contentType: file.mimetype,
        upsert: true,
      });

    if (error) {
      console.error('Supabase Private Upload Error:', error);
      throw new InternalServerErrorException(
        error.message || `Error uploading private file to ${bucket}`,
      );
    }

    return {
      bucket,
      path,
      storageRef: this.buildPrivateStorageRef(bucket, path),
    };
  }

  async createSignedUpload(
    bucket: string,
    path: string,
  ): Promise<SignedUploadPayload> {
    await this.ensureBucket(bucket, true);

    const { data, error } = await this.supabase.storage
      .from(bucket)
      .createSignedUploadUrl(path);

    if (error || !data?.token) {
      console.error('Supabase Signed Upload Error:', error);
      throw new InternalServerErrorException(
        error?.message || `Error creating signed upload for ${bucket}`,
      );
    }

    return {
      path: data.path,
      token: data.token,
      signedUrl: 'signedUrl' in data ? data.signedUrl : undefined,
    };
  }

  getPublicUrl(bucket: string, path: string): string {
    const { data } = this.supabase.storage.from(bucket).getPublicUrl(path);
    return data.publicUrl;
  }

  async createSignedReadUrl(
    bucket: string,
    path: string,
    expiresInSeconds = 300,
  ) {
    await this.ensureBucket(bucket, false);

    const { data, error } = await this.supabase.storage
      .from(bucket)
      .createSignedUrl(path, expiresInSeconds);

    if (error || !data?.signedUrl) {
      console.error('Supabase Signed Read Error:', error);
      throw new InternalServerErrorException(
        error?.message || `Error creating signed read URL for ${bucket}`,
      );
    }

    return data.signedUrl;
  }

  buildPrivateStorageRef(bucket: string, path: string) {
    return `private://${bucket}/${path}`;
  }

  parsePrivateStorageRef(storageRef: string) {
    if (!storageRef.startsWith('private://')) {
      return null;
    }

    const withoutScheme = storageRef.slice('private://'.length);
    const separatorIndex = withoutScheme.indexOf('/');

    if (separatorIndex <= 0) {
      return null;
    }

    return {
      bucket: withoutScheme.slice(0, separatorIndex),
      path: withoutScheme.slice(separatorIndex + 1),
    };
  }

  resolveStorageLocation(storageRef: string, fallbackBucket?: string) {
    const privateLocation = this.parsePrivateStorageRef(storageRef);
    if (privateLocation) {
      return privateLocation;
    }

    if (!fallbackBucket) {
      return null;
    }

    const path = this.extractBucketRelativePath(storageRef, fallbackBucket);
    return path ? { bucket: fallbackBucket, path } : null;
  }

  async cleanupStaleCustomDesignUploads(maxAgeHours = 48) {
    const bucket = 'product-assets';
    const prefix = 'custom-designs';
    const cutoff = Date.now() - maxAgeHours * 60 * 60 * 1000;

    await this.ensureBucket(bucket, true);

    const referencedPaths = await this.getReferencedCustomDesignPaths();
    const stalePaths: string[] = [];
    let offset = 0;
    const pageSize = 100;

    while (true) {
      const { data, error } = await this.supabase.storage
        .from(bucket)
        .list(prefix, {
          limit: pageSize,
          offset,
          sortBy: { column: 'name', order: 'asc' },
        });

      if (error) {
        throw new InternalServerErrorException(
          error.message || 'Error listing custom design uploads',
        );
      }

      const files = data || [];

      for (const file of files) {
        if (!file.name) {
          continue;
        }

        const fullPath = `${prefix}/${file.name}`;
        if (referencedPaths.has(fullPath)) {
          continue;
        }

        const createdAt =
          ('created_at' in file && typeof file.created_at === 'string'
            ? file.created_at
            : 'updated_at' in file && typeof file.updated_at === 'string'
              ? file.updated_at
              : null) || null;
        const createdAtMs = createdAt ? Date.parse(createdAt) : NaN;

        if (!Number.isFinite(createdAtMs) || createdAtMs > cutoff) {
          continue;
        }

        stalePaths.push(fullPath);
      }

      if (files.length < pageSize) {
        break;
      }

      offset += files.length;
    }

    if (stalePaths.length === 0) {
      return { removed: 0 };
    }

    const { error } = await this.supabase.storage
      .from(bucket)
      .remove(stalePaths);

    if (error) {
      throw new InternalServerErrorException(
        error.message || 'Error removing stale custom design uploads',
      );
    }

    this.logger.log(
      `Removed ${stalePaths.length} stale custom design upload(s)`,
    );

    return { removed: stalePaths.length };
  }

  private async getReferencedCustomDesignPaths() {
    const items = await this.prisma.orderItem.findMany({
      where: {
        OR: [
          { imageUrl: { contains: '/custom-designs/' } },
          {
            configurationJson: {
              path: ['customImageURL'],
              string_contains: '/custom-designs/',
            },
          },
        ],
      },
      select: {
        imageUrl: true,
        configurationJson: true,
      },
    });

    const paths = new Set<string>();

    for (const item of items) {
      const fromImage = this.extractBucketRelativePath(
        item.imageUrl,
        'product-assets',
      );
      if (fromImage) {
        paths.add(fromImage);
      }

      const customImageUrl = this.readCustomImageUrl(item.configurationJson);
      const fromConfig = this.extractBucketRelativePath(
        customImageUrl,
        'product-assets',
      );
      if (fromConfig) {
        paths.add(fromConfig);
      }
    }

    return paths;
  }

  private readCustomImageUrl(value: Prisma.JsonValue | null) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return null;
    }

    const raw = value as Record<string, Prisma.JsonValue>;
    return typeof raw.customImageURL === 'string' ? raw.customImageURL : null;
  }

  private extractBucketRelativePath(
    maybeUrl: string | null | undefined,
    bucket: string,
  ) {
    if (!maybeUrl) {
      return null;
    }

    const marker = `/${bucket}/`;
    const markerIndex = maybeUrl.indexOf(marker);

    if (markerIndex >= 0) {
      return maybeUrl.slice(markerIndex + marker.length);
    }

    try {
      const parsed = new URL(maybeUrl);
      const pathMarker = `/object/public/${bucket}/`;
      const pathIndex = parsed.pathname.indexOf(pathMarker);

      if (pathIndex >= 0) {
        return parsed.pathname.slice(pathIndex + pathMarker.length);
      }
    } catch {
      return null;
    }

    return null;
  }

  private async ensureBucket(bucket: string, publicAccess: boolean) {
    if (this.ensuredBuckets.has(bucket)) {
      return;
    }

    const { data: existingBuckets, error: listError } =
      await this.supabase.storage.listBuckets();

    if (listError) {
      console.error('Supabase List Buckets Error:', listError);
      throw new InternalServerErrorException(
        listError.message || 'Error listing storage buckets',
      );
    }

    const bucketExists = existingBuckets?.some(
      (existingBucket) => existingBucket.name === bucket,
    );
    const existingBucket = existingBuckets?.find(
      (candidate) => candidate.name === bucket,
    );

    if (!bucketExists) {
      const { error: createError } = await this.supabase.storage.createBucket(
        bucket,
        {
          public: publicAccess,
        },
      );

      if (
        createError &&
        !createError.message.toLowerCase().includes('exists')
      ) {
        console.error('Supabase Create Bucket Error:', createError);
        throw new InternalServerErrorException(
          createError.message || `Error creating storage bucket ${bucket}`,
        );
      }
    } else if (
      existingBucket &&
      'public' in existingBucket &&
      typeof existingBucket.public === 'boolean' &&
      existingBucket.public !== publicAccess
    ) {
      const { error: updateError } = await this.supabase.storage.updateBucket(
        bucket,
        {
          public: publicAccess,
        },
      );

      if (updateError) {
        console.error('Supabase Update Bucket Error:', updateError);
        throw new InternalServerErrorException(
          updateError.message || `Error updating storage bucket ${bucket}`,
        );
      }
    }

    this.ensuredBuckets.add(bucket);
  }
}
