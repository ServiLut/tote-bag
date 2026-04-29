import { Prisma } from '../../generated/client/client';
import { isDatabaseUnavailablePrismaError } from './prisma-connection.filter';

describe('isDatabaseUnavailablePrismaError', () => {
  it('detects adapter-level socket permission errors', () => {
    const error = new Prisma.PrismaClientKnownRequestError(
      'connect EACCES 76.13.101.140:5432',
      {
        code: 'EACCES',
        clientVersion: 'test',
      },
    );

    expect(isDatabaseUnavailablePrismaError(error)).toBe(true);
  });

  it('detects classic prisma reachability errors by message', () => {
    const error = new Prisma.PrismaClientKnownRequestError(
      "Can't reach database server at `db.example.com:5432`",
      {
        code: 'P5000',
        clientVersion: 'test',
      },
    );

    expect(isDatabaseUnavailablePrismaError(error)).toBe(true);
  });

  it('ignores non-connectivity prisma request errors', () => {
    const error = new Prisma.PrismaClientKnownRequestError(
      'Unique constraint failed on the fields: (`slug`)',
      {
        code: 'P2002',
        clientVersion: 'test',
      },
    );

    expect(isDatabaseUnavailablePrismaError(error)).toBe(false);
  });
});
