import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Request } from 'express';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Prisma } from '../../generated/client/client';
import { PrismaService } from '../../prisma/prisma.service';

interface RequestWithUser extends Request {
  user?: {
    id: string;
    [key: string]: unknown;
  };
}

type AuditEntity =
  | 'Auth'
  | 'B2BQuote'
  | 'FinancialTransaction'
  | 'Order'
  | 'PersonalizationRequest'
  | 'PayrollBillingStatement'
  | 'PayrollWorker'
  | 'PayrollShift'
  | 'Product'
  | 'Profile'
  | 'PurchaseBatch'
  | 'PqrsTicket'
  | 'Shipment'
  | 'ShippingProvider'
  | 'Supplier'
  | 'System'
  | 'User'
  | 'Variant'
  | 'WizardOption'
  | 'OpexCategory';

const WRITE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
const ENTITY_ID_PARAM_KEYS = [
  'id',
  'entityId',
  'orderId',
  'productId',
  'userId',
];

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(private readonly prisma: PrismaService) {}

  private normalizeEntityId(entity: AuditEntity, id: string) {
    const intIdEntities = new Set<AuditEntity>([
      'PayrollBillingStatement',
      'PayrollWorker',
      'PayrollShift',
    ]);

    if (!intIdEntities.has(entity)) {
      return id;
    }

    const numericId = Number(id);
    return Number.isInteger(numericId) ? numericId : null;
  }

  async intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Promise<Observable<unknown>> {
    const http = context.switchToHttp();
    const request = http.getRequest<RequestWithUser>();
    const method = request.method;

    if (!WRITE_METHODS.has(method)) {
      return next.handle();
    }

    const body = request.body as unknown;
    const ip = request.ip;
    const userAgent = request.headers['user-agent'];
    const user = request.user;
    const params = request.params as Record<string, string | undefined>;
    const segments = this.getPathSegments(request.originalUrl || request.url);
    const contextInfo = this.resolveAuditContext(segments, params, body, null);

    let previousData: unknown = null;
    if (
      (method === 'PUT' || method === 'PATCH' || method === 'DELETE') &&
      contextInfo.entityId
    ) {
      previousData = await this.getPreviousData(
        contextInfo.entity,
        contextInfo.entityId,
      );
    }

    return next.handle().pipe(
      tap((result) => {
        const finalContext = this.resolveAuditContext(
          segments,
          params,
          body,
          this.extractResponseData(result),
        );

        this.logAction(
          method,
          finalContext.entity,
          finalContext.entityId,
          body,
          previousData,
          user?.id,
          ip,
          userAgent,
        ).catch((error) => console.error('Audit Log Error:', error));
      }),
    );
  }

  private getPathSegments(url: string) {
    const cleanUrl = url.split('?')[0] || '';

    return cleanUrl
      .split('/')
      .map((segment) => segment.trim())
      .filter(Boolean)
      .filter((segment) => segment !== 'api' && !/^v\d+$/i.test(segment));
  }

  private resolveAuditContext(
    segments: string[],
    params: Record<string, string | undefined>,
    body: unknown,
    responseData: unknown,
  ): { entity: AuditEntity; entityId: string | null } {
    const [root, child, third] = segments;
    const entity = this.resolveEntity(root, child, third, params);
    const entityId = this.resolveEntityId(params, body, responseData);

    return { entity, entityId };
  }

  private resolveEntity(
    root?: string,
    child?: string,
    third?: string,
    params?: Record<string, string | undefined>,
  ): AuditEntity {
    if (root === 'catalog') return 'Product';
    if (root === 'catalog' && child === 'products') return 'Product';
    if (root === 'products') return 'Product';
    if (root === 'orders') return 'Order';
    if (root === 'profiles') return 'Profile';
    if (root === 'b2b') return 'B2BQuote';
    if (root === 'personalizations' && child === 'requests') {
      return 'PersonalizationRequest';
    }
    if (root === 'auth') return 'Auth';
    if (root === 'users') return 'User';
    if (root === 'pqrs') return 'PqrsTicket';
    if (root === 'wizard') return 'WizardOption';

    if (root === 'payments' && child === 'upload-receipt') {
      if (third === 'order') return 'Order';
      if (third === 'b2b') return 'B2BQuote';
      if (third === 'batch') return 'PurchaseBatch';
    }

    if (root === 'shipping') {
      if (child === 'providers') return 'ShippingProvider';
      if (child === 'shipments') return 'Shipment';
      return 'Shipment';
    }

    if (root === 'inventory') {
      if (
        child === 'batch' ||
        child === 'batches' ||
        child === 'receive-batch'
      ) {
        return 'PurchaseBatch';
      }
      if (child === 'suppliers') {
        return third === 'payments' ? 'FinancialTransaction' : 'Supplier';
      }
      if (child === 'finance') {
        if (third === 'opex') return 'FinancialTransaction';
        if (third === 'opex-categories') return 'OpexCategory';
        return 'FinancialTransaction';
      }
      if (child === 'reporting') return 'System';
      return 'PurchaseBatch';
    }

    if (root === 'payroll') {
      if (child === 'workers') return 'PayrollWorker';
      if (child === 'shifts') return 'PayrollShift';
      if (child === 'statements') return 'PayrollBillingStatement';
      return 'PayrollBillingStatement';
    }

    if (params?.orderId) return 'Shipment';
    return 'System';
  }

  private resolveEntityId(
    params: Record<string, string | undefined>,
    body: unknown,
    responseData: unknown,
  ) {
    for (const key of ENTITY_ID_PARAM_KEYS) {
      const paramValue = params[key];
      if (paramValue) {
        return paramValue;
      }
    }

    const bodyId = this.extractId(body);
    if (bodyId) {
      return bodyId;
    }

    return this.extractId(responseData);
  }

  private extractId(value: unknown): string | null {
    if (!value || typeof value !== 'object') {
      return null;
    }

    for (const key of ['id', 'entityId', 'orderId']) {
      if (key in value) {
        const candidate = (value as Record<string, unknown>)[key];
        if (typeof candidate === 'string' || typeof candidate === 'number') {
          return String(candidate);
        }
      }
    }

    return null;
  }

  private extractResponseData(result: unknown) {
    if (
      result &&
      typeof result === 'object' &&
      'data' in result &&
      (result as Record<string, unknown>).data
    ) {
      return (result as Record<string, unknown>).data;
    }

    return result;
  }

  private async getPreviousData(
    entity: AuditEntity,
    id: string,
  ): Promise<unknown> {
    const modelMap: Record<AuditEntity, string | null> = {
      Auth: null,
      B2BQuote: 'b2BQuote',
      FinancialTransaction: 'financialTransaction',
      OpexCategory: 'opexCategory',
      Order: 'order',
      PersonalizationRequest: 'personalizationRequest',
      PayrollBillingStatement: 'payrollBillingStatement',
      PayrollWorker: 'payrollWorker',
      PayrollShift: 'payrollShift',
      Product: 'product',
      Profile: 'profile',
      PurchaseBatch: 'purchaseBatch',
      PqrsTicket: 'pqrsTicket',
      Shipment: 'shipment',
      ShippingProvider: 'shippingProvider',
      Supplier: 'supplier',
      System: null,
      User: 'user',
      Variant: 'variant',
      WizardOption: 'wizardOption',
    };

    const modelName = modelMap[entity];
    if (!modelName) {
      return null;
    }

    try {
      const normalizedId = this.normalizeEntityId(entity, id);
      if (normalizedId === null) {
        return null;
      }

      const model = (this.prisma as unknown as Record<string, unknown>)[
        modelName
      ];
      if (
        model &&
        typeof (model as Record<string, unknown>).findUnique === 'function'
      ) {
        return await (
          model as {
            findUnique: (args: {
              where: { id: string | number };
            }) => Promise<unknown>;
          }
        ).findUnique({ where: { id: normalizedId } });
      }
    } catch (error) {
      console.error('Failed to fetch previous data for audit:', error);
    }

    return null;
  }

  private async logAction(
    method: string,
    entity: AuditEntity,
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
          entity,
          entityId,
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
