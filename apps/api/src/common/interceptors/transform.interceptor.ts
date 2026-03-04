import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { ApiResponse } from '../interfaces/api-response.interface';
import { Response } from 'express';

@Injectable()
export class TransformInterceptor<T> implements NestInterceptor<
  T,
  ApiResponse<T> | T
> {
  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<ApiResponse<T> | T> {
    return next.handle().pipe(
      map((data: T) => {
        const response = context.switchToHttp().getResponse<Response>();

        // Skip transformation if headers are already sent or data is binary/buffer
        if (response.headersSent || data instanceof Buffer) {
          return data;
        }

        return {
          success: true,
          data,
          error: null,
          metadata: {
            timestamp: new Date().toISOString(),
            version: 'v1',
          },
        };
      }),
    );
  }
}
