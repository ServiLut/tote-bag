import { INestApplication } from '@nestjs/common';
import { Response } from 'express';
import request from 'supertest';
import { Role } from '../src/generated/client/client';
import { PayrollController } from '../src/modules/payroll/payroll.controller';
import { PayrollPdfService } from '../src/modules/payroll/payroll.pdf.service';
import { PayrollService } from '../src/modules/payroll/payroll.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { RolesService } from '../src/modules/roles/roles.service';
import {
  closeTestApp,
  createTestApp,
  getTestServer,
} from './helpers/create-test-app';

describe('PayrollController (e2e)', () => {
  let app: INestApplication;

  const payrollService = {
    getWorkers: jest.fn(),
    getWorkerHistory: jest.fn(),
    getShifts: jest.fn(),
    getStatements: jest.fn(),
    getStatementById: jest.fn(),
    getStatementWithShifts: jest.fn(),
    createWorker: jest.fn(),
    updateWorker: jest.fn(),
    createShift: jest.fn(),
    updateShift: jest.fn(),
    deleteShift: jest.fn(),
    consolidateStatement: jest.fn(),
    updateStatementStatus: jest.fn(),
  };
  const payrollPdfService = {
    generateStatementPdf: jest.fn(),
  };
  const prismaService = {
    user: {
      findUnique: jest.fn(),
    },
  };
  const rolesService = {
    getEffectiveRole: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    prismaService.user.findUnique.mockResolvedValue({ role: Role.ADMIN });
    rolesService.getEffectiveRole.mockResolvedValue({
      effectiveRole: Role.ADMIN,
    });

    const setup = await createTestApp({
      controllers: [PayrollController],
      providers: [
        { provide: PayrollService, useValue: payrollService },
        { provide: PayrollPdfService, useValue: payrollPdfService },
        { provide: PrismaService, useValue: prismaService },
        { provide: RolesService, useValue: rolesService },
      ],
    });

    app = setup.app;
  });

  afterEach(async () => {
    await closeTestApp(app);
  });

  it('GET /api/v1/payroll/shifts devuelve la lista de turnos', async () => {
    payrollService.getShifts.mockResolvedValue([{ id: 1 }]);

    const response = await request(getTestServer(app))
      .get('/api/v1/payroll/shifts')
      .set('x-test-user-id', 'admin-1')
      .expect(200);

    expect(response.body).toEqual([{ id: 1 }]);
  });

  it('GET /api/v1/payroll/workers devuelve la lista de trabajadores', async () => {
    payrollService.getWorkers.mockResolvedValue([
      { id: 1, displayName: 'Maria' },
    ]);

    const response = await request(getTestServer(app))
      .get('/api/v1/payroll/workers')
      .set('x-test-user-id', 'admin-1')
      .expect(200);

    expect(response.body).toEqual([{ id: 1, displayName: 'Maria' }]);
  });

  it('GET /api/v1/payroll/workers/:id/history devuelve el historial del trabajador', async () => {
    payrollService.getWorkerHistory.mockResolvedValue({
      id: 1,
      displayName: 'Maria',
    });

    const response = await request(getTestServer(app))
      .get('/api/v1/payroll/workers/1/history')
      .set('x-test-user-id', 'admin-1')
      .expect(200);

    expect(response.body).toEqual({ id: 1, displayName: 'Maria' });
    expect(payrollService.getWorkerHistory).toHaveBeenCalledWith(1);
  });

  it('POST /api/v1/payroll/workers crea trabajador y reenvia el usuario autenticado', async () => {
    payrollService.createWorker.mockResolvedValue({
      id: 3,
      displayName: 'Pedro',
    });

    await request(getTestServer(app))
      .post('/api/v1/payroll/workers')
      .set('x-test-user-id', 'admin-1')
      .send({
        displayName: 'Pedro',
        documentNumber: '123',
        hourlyRate: 15000,
      })
      .expect(201);

    expect(payrollService.createWorker).toHaveBeenCalledWith(
      {
        displayName: 'Pedro',
        documentNumber: '123',
        hourlyRate: 15000,
      },
      'admin-1',
    );
  });

  it('POST /api/v1/payroll/shifts valida payload requerido', async () => {
    await request(getTestServer(app))
      .post('/api/v1/payroll/shifts')
      .set('x-test-user-id', 'admin-1')
      .field('collaborator', 'Maria')
      .field('workDate', 'fecha-invalida')
      .field('startTime', '08:00')
      .field('endTime', '17:00')
      .field('totalAmount', '96000')
      .expect(400);

    expect(payrollService.createShift).not.toHaveBeenCalled();
  });

  it('PATCH /api/v1/payroll/statements/:id/status reenvia usuario autenticado al servicio', async () => {
    payrollService.updateStatementStatus.mockResolvedValue({
      id: 10,
      status: 'PAGADA',
    });

    await request(getTestServer(app))
      .patch('/api/v1/payroll/statements/10/status')
      .set('x-test-user-id', 'admin-1')
      .send({ status: 'PAGADA' })
      .expect(200);

    expect(payrollService.updateStatementStatus).toHaveBeenCalledWith(
      10,
      { status: 'PAGADA' },
      'admin-1',
    );
  });

  it('GET /api/v1/payroll/statements/:id devuelve el detalle de la cuenta', async () => {
    payrollService.getStatementById.mockResolvedValue({ id: 10 });

    const response = await request(getTestServer(app))
      .get('/api/v1/payroll/statements/10')
      .set('x-test-user-id', 'admin-1')
      .expect(200);

    expect(response.body).toEqual({ id: 10 });
    expect(payrollService.getStatementById).toHaveBeenCalledWith(10);
  });

  it('GET /api/v1/payroll/statements/:id/pdf genera la descarga del PDF', async () => {
    payrollService.getStatementWithShifts.mockResolvedValue({
      id: 14,
      collaborator: 'Maria',
      shifts: [],
    });
    payrollPdfService.generateStatementPdf.mockImplementation((res: Response) =>
      res.type('application/pdf').status(200).send('pdf-binary'),
    );

    const response = await request(getTestServer(app))
      .get('/api/v1/payroll/statements/14/pdf')
      .set('x-test-user-id', 'admin-1')
      .expect(200);

    expect(response.headers['content-type']).toContain('application/pdf');
    expect(response.headers['content-disposition']).toContain(
      'Cuenta_Cobro_Nomina_14.pdf',
    );
    expect(payrollService.getStatementWithShifts).toHaveBeenCalledWith(14);
    expect(payrollPdfService.generateStatementPdf).toHaveBeenCalled();
  });
});
