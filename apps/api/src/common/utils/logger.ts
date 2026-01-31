import pino from 'pino';

export const createLogger = () =>
  pino({
    level: process.env.LOG_LEVEL ?? 'info',
    redact: {
      paths: [
        'req.headers.authorization',
        'req.headers.cookie',
        'password',
        '*.password',
        '*.password_hash',
        '*.email',
        '*.phone',
        '*.phone_number',
        '*.tax_id',
        '*.taxId',
      ],
      censor: '[REDACTED]',
    },
  });
