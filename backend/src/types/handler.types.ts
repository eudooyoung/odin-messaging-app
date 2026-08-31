import type { RequestHandler } from "express";
import type {
  LoginInput,
  LoginResponseBody,
  RegisterInput,
  RegisterResponseBody,
} from "./api.types";

export type RegisterHandler = RequestHandler<
  Record<string, never>,
  RegisterResponseBody,
  RegisterInput
>;

export type LoginHandler = RequestHandler<
  Record<string, never>,
  LoginResponseBody,
  LoginInput
>;
