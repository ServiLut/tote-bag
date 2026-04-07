import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class CreateSignedDesignUploadDto {
  @IsString()
  fileName: string;

  @IsString()
  mimeType: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5 * 1024 * 1024)
  size?: number;
}
