import type { RequestHandler } from "express";
import type { RegisterInput, RegisterResponseBody } from "./api.types";

export type RegisterHandler = RequestHandler<
  Record<string, never>,
  RegisterResponseBody,
  RegisterInput
>;
