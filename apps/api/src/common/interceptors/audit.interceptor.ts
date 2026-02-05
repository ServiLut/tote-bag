import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { PrismaService } from '../../prisma/prisma.service';
import { Prisma } from '../../generated/client/client';
import { Request } from 'express';

interface RequestWithUser extends Request {
  user?: {
    id: string;
    [key: string]: unknown;
  };
}

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(private readonly prisma: PrismaService) {}

  async intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Promise<Observable<unknown>> {
    const http = context.switchToHttp();
    const request = http.getRequest<RequestWithUser>();
    const method = request.method;
    const url = request.url;
    const body = request.body as unknown;
    const ip = request.ip;
    const userAgent = request.headers['user-agent'];
    const user = request.user;
    const params = request.params as Record<string, string | undefined>;

    const writeMethods = ['POST', 'PUT', 'PATCH', 'DELETE'];
    if (!writeMethods.includes(method)) {
      return next.handle();
    }

    const entity = url.split('/')[1]?.split('?')[0] || 'unknown';
    const bodyId =
      body && typeof body === 'object' && 'id' in body
        ? (body as { id: unknown }).id
        : null;

    let entityId: string | null = null;
    if (typeof bodyId === 'string' || typeof bodyId === 'number') {
      entityId = String(bodyId);
    } else {
      const paramId = params?.['id'];
      if (paramId) {
        entityId = paramId;
      }
    }

    // Capture previous data if updating or deleting
    let previousData: any = null;
    if (
      (method === 'PUT' || method === 'PATCH' || method === 'DELETE') &&
      entityId
    ) {
      try {
        previousData = await this.getPreviousData(entity, entityId);
      } catch (e) {
        console.error('Failed to fetch previous data for audit:', e);
      }
    }

    return next.handle().pipe(
      tap(() => {
        // Execute logging in background to not block the response
        this.logAction(
          method,
          entity,
          entityId,
          body,
          previousData,
          user?.id,
          ip,
          userAgent,
        ).catch((err) => console.error('Audit Log Error:', err));
      }),
    );
  }

  private async getPreviousData(entity: string, id: string): Promise<unknown> {
    try {
      // Map entity names to prisma models
      const modelMap: Record<string, string> = {
        products: 'product',
        orders: 'order',
        profiles: 'profile',
        b2b: 'b2BQuote', // case sensitive as per prisma client
      };

      const modelName = modelMap[entity];
      if (!modelName) return null;

      // Access prisma model dynamically
      const model = (this.prisma as unknown as Record<string, unknown>)[
        modelName
      ];
      if (
        model &&
        typeof (model as Record<string, unknown>).findUnique === 'function'
      ) {
        return await (
          model as {
            findUnique: (args: { where: { id: string } }) => Promise<unknown>;
          }
        ).findUnique({ where: { id } });
      }
    } catch {
      return null;
    }
    return null;
  }

  private async logAction(
    method: string,
    entity: string,
    entityId: string | null,
    body: unknown,
    previousData: unknown,
    userId?: string,
    ip?: string,
    userAgent?: string,
  ) {
    try {
      await this.prisma.auditLog.create({
        data: {
          action: method,
          entity: entity,
          entityId: entityId,
          payload:
            body && typeof body === 'object' && Object.keys(body).length > 0
              ? (body as Prisma.InputJsonValue)
              : Prisma.JsonNull,
          previousData: previousData
            ? (previousData as Prisma.InputJsonValue)
            : Prisma.JsonNull,
          userId: userId || null,
          ip: ip || null,
          userAgent: userAgent || null,
        },
      });
    } catch (error) {
      console.error('Failed to save audit log:', error);
    }
  }
}
