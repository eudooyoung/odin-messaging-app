declare global {
  namespace NodeJS {
    interface ProcessEnv {
      PORT: string;
      JWT_SECRET: string;
      DATABASE_URL: string;
      TEST_DATABASE_URL: string;
      APP_DEBUG: string;
    }
  }
}

export {};
