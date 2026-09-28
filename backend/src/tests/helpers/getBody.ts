import type { Response } from "supertest";

export const getBody = <T>(response: Response) => response.body as T;
