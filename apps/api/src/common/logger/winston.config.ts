import { WinstonModule } from 'nest-winston';
import * as winston from 'winston';

export const winstonConfig = WinstonModule.createLogger({
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.ms(),
        process.env.NODE_ENV === 'production'
          ? winston.format.json()
          : winston.format.combine(
              winston.format.colorize(),
              winston.format.printf((info) => {
                const { level, message, ...meta } = info;

                const ts = meta['timestamp'];
                const timestampStr = typeof ts === 'string' ? ts : '';

                const levelStr = typeof level === 'string' ? level : '';

                const msgStr =
                  typeof message === 'string'
                    ? message
                    : message
                      ? JSON.stringify(message)
                      : '';

                const ctx = meta['context'];
                const contextStr =
                  typeof ctx === 'string'
                    ? ctx
                    : ctx
                      ? JSON.stringify(ctx)
                      : 'Application';

                const ms = meta['ms'];
                const msStr = typeof ms === 'string' ? ms : '';

                return `[Nest] ${timestampStr} ${levelStr} [${contextStr}] ${msgStr} ${msStr}`;
              }),
            ),
      ),
    }),
  ],
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
});
