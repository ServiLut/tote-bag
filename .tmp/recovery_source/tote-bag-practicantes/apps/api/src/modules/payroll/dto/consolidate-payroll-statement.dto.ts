import { Transform } from 'class-transformer';
import { ArrayUnique, IsArray, IsInt, IsOptional, Min } from 'class-validator';

export class ConsolidatePayrollStatementDto {
  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(1)
  workerId?: number;

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @Transform(({ value }) => {
    if (Array.isArray(value)) {
      return value.map((item: unknown) => Number(item));
    }

    return value as unknown;
  })
  @IsInt({ each: true })
  @Min(1, { each: true })
  shiftIds?: number[];
}
