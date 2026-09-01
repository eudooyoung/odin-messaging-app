import type { RequestHandler } from "express";
import type {
  LoginInput,
  LoginResponseBody,
  RefreshResponseBody,
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

export type RefreshHandler = RequestHandler<
  Record<string, never>,
  RefreshResponseBody,
  Record<string, never>
>;
