import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreatePqrsDto } from './dto/create-pqrs.dto';
import { UpdatePqrsTicketDto } from './dto/update-pqrs-ticket.dto';

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

  findAll(status?: string) {
    return this.prisma.pqrsTicket.findMany({
      where: status ? { status: status as never } : undefined,
      orderBy: [{ createdAt: 'desc' }],
    });
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
}
