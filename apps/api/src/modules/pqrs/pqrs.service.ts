import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreatePqrsDto } from './dto/create-pqrs.dto';
import { UpdatePqrsTicketDto } from './dto/update-pqrs-ticket.dto';
import { PqrsStatus } from '../../generated/client/enums';

@Injectable()
export class PqrsService {
  constructor(private readonly prisma: PrismaService) {}

  create(dto: CreatePqrsDto) {
    return this.prisma.pqrsTicket.create({
      data: {
        fullName: dto.fullName,
        email: dto.email,
        phone: dto.phone,
        type: dto.type,
        subject: dto.subject,
        message: dto.message,
        orderNumber: dto.orderNumber,
      },
    });
  }

  async findAll(status?: string) {
    try {
      return await this.prisma.pqrsTicket.findMany({
        where: this.getStatusWhere(status),
        orderBy: [{ createdAt: 'desc' }],
      });
    } catch (error) {
      console.error('PQRS inbox query failed:', error);
      return [];
    }
  }

  async countByStatus(status?: string) {
    try {
      return {
        count: await this.prisma.pqrsTicket.count({
          where: this.getStatusWhere(status),
        }),
      };
    } catch (error) {
      console.error('PQRS count failed:', error);
      return { count: 0 };
    }
  }

  update(id: string, dto: UpdatePqrsTicketDto) {
    return this.prisma.pqrsTicket.update({
      where: { id },
      data: {
        status: dto.status,
        adminResponse: dto.adminResponse,
        resolvedAt:
          dto.status === 'RESPONDIDO' || dto.status === 'CERRADO'
            ? new Date()
            : null,
      },
    });
  }

  private getStatusWhere(status?: string) {
    return status ? { status: status as PqrsStatus } : undefined;
  }
}
