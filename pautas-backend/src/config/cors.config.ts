import { CorsOptions } from 'cors';
import { env } from './environment';

const allowedOrigins = [
  env.frontendUrl,
  'http://localhost:4200',
  'http://localhost:4201',
];

export const corsOptions: CorsOptions = {
  origin: env.isProduction
    ? env.frontendUrl
    : (origin, callback) => {
        if (!origin || allowedOrigins.includes(origin)) {
          callback(null, true);
        } else {
          callback(new Error('Not allowed by CORS'));
        }
      },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};
