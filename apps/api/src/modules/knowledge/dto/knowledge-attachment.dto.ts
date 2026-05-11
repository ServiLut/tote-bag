import {
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class KnowledgeAttachmentDto {
  @IsString()
  @MaxLength(255)
  name!: string;

  @IsString()
  @MaxLength(2048)
  @IsUrl(
    { require_tld: false },
    { message: 'attachment url must be a valid URL' },
  )
  url!: string;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  mimeType?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100 * 1024 * 1024)
  size?: number;
}
