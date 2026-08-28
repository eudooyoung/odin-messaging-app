declare global {
  namespace NodeJS {
    interface ProcessEnv {
      PORT: string;
      JWT_SECRET: string;
      DATABASE_URL: string;
      APP_DEBUG: string;
      DB_ENV?: string;
    }
  }
}

export {};
