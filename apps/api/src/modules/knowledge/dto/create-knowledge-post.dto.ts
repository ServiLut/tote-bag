import { Transform, Type } from 'class-transformer';
import {
  IsArray,
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import {
  KnowledgeCategory,
  KnowledgePriority,
  KnowledgeStatus,
} from '../../../generated/client/enums';
import { KnowledgeAttachmentDto } from './knowledge-attachment.dto';

function trimString(value: unknown) {
  return typeof value === 'string' ? value.trim() : value;
}

function trimStringOrUndefined(value: unknown) {
  if (typeof value !== 'string') {
    return value;
  }

  const trimmedValue = value.trim();
  return trimmedValue.length > 0 ? trimmedValue : undefined;
}

export class CreateKnowledgePostDto {
  @Transform(({ value }) => trimString(value))
  @IsString()
  @MinLength(3)
  @MaxLength(180)
  title!: string;

  @Transform(({ value }) => trimStringOrUndefined(value))
  @IsOptional()
  @IsString()
  @MaxLength(200)
  slug?: string;

  @Transform(({ value }) => trimStringOrUndefined(value))
  @IsOptional()
  @IsString()
  @MaxLength(500)
  summary?: string;

  @Transform(({ value }) => trimString(value))
  @IsString()
  @MinLength(10)
  content!: string;

  @IsOptional()
  @IsEnum(KnowledgeCategory)
  category?: KnowledgeCategory;

  @IsOptional()
  @IsEnum(KnowledgeStatus)
  status?: KnowledgeStatus;

  @IsOptional()
  @IsEnum(KnowledgePriority)
  priority?: KnowledgePriority;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @MaxLength(50, { each: true })
  @Transform(({ value }) => {
    if (value === undefined || value === null) {
      return undefined;
    }

    if (typeof value === 'string') {
      return value
        .split(',')
        .map((tag) => tag.trim())
        .filter(Boolean);
    }

    if (!Array.isArray(value)) {
      return undefined;
    }

    return value
      .map((tag: unknown) =>
        typeof tag === 'string' ? tag.trim() : String(tag).trim(),
      )
      .filter(Boolean);
  })
  tags?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @IsUrl(
    { require_tld: false },
    {
      each: true,
      message: 'each imageUrl must be a valid URL',
    },
  )
  @Transform(({ value }) => {
    if (value === undefined || value === null) {
      return undefined;
    }

    if (typeof value === 'string') {
      return value
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean);
    }

    if (!Array.isArray(value)) {
      return undefined;
    }

    return value
      .map((item: unknown) =>
        typeof item === 'string' ? item.trim() : String(item).trim(),
      )
      .filter(Boolean);
  })
  imageUrls?: string[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => KnowledgeAttachmentDto)
  attachments?: KnowledgeAttachmentDto[];

  @Transform(({ value }) => trimStringOrUndefined(value))
  @IsOptional()
  @IsString()
  authorId?: string;

  @IsOptional()
  @IsDateString()
  publishedAt?: string;
}
