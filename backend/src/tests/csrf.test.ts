import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "@/app.js";
import { env } from "@/config/env.config.js";
import { createAccessTokenCookie } from "@/tests/helpers/createAccessTokenCookie.js";

const handlerPath = "/users/csrf-test/handler";
const stateChangingMethods = ["post", "patch", "put", "delete"] as const;

const createAppWithHandler = () => {
  const app = createApp();
  app.all(handlerPath, (_req, res) => {
    res.status(204).end();
  });
  return app;
};

describe("CSRF request origin", () => {
  describe("state-changing requests", () => {
    it.each(stateChangingMethods)("allows %s from FRONTEND_ORIGIN", async (method) => {
      const appRequest = request(createAppWithHandler());
      const response = await appRequest[method](handlerPath)
        .set("Origin", env.frontendOrigin)
        .set("Cookie", createAccessTokenCookie(1));

      expect(response.status).toBe(204);
    });

    it.each(stateChangingMethods)(
      "rejects %s from another Origin before the handler responds",
      async (method) => {
        const appRequest = request(createAppWithHandler());
        const response = await appRequest[method](handlerPath)
          .set("Origin", "https://untrusted.example")
          .set("Cookie", createAccessTokenCookie(1));

        expect(response.status).toBe(403);
      },
    );

    it.each([
      { caseName: "missing", origin: undefined },
      { caseName: "null", origin: "null" },
      { caseName: "not an exact match", origin: `${env.frontendOrigin}/` },
    ])("rejects a POST whose Origin is $caseName", async ({ origin }) => {
      let pendingRequest = request(createAppWithHandler())
        .post(handlerPath)
        .set("Cookie", createAccessTokenCookie(1));
      if (origin !== undefined) {
        pendingRequest = pendingRequest.set("Origin", origin);
      }

      const response = await pendingRequest;

      expect(response.status).toBe(403);
    });

    it("protects auth logout even without authentication cookies", async () => {
      const response = await request(createApp())
        .post("/auth/logout")
        .set("Origin", "https://untrusted.example");

      expect(response.status).toBe(403);
      expect(response.get("Set-Cookie")).toBeUndefined();
    });
  });

  describe("read-only requests and preflight", () => {
    it.each([
      { method: "get", origin: "https://untrusted.example" },
      { method: "head", origin: "https://untrusted.example" },
      { method: "get", origin: undefined },
      { method: "head", origin: undefined },
    ] as const)("allows $method with Origin $origin", async ({ method, origin }) => {
      let pendingRequest = request(createAppWithHandler())[method](handlerPath);
      if (origin !== undefined) {
        pendingRequest = pendingRequest.set("Origin", origin);
      }

      const response = await pendingRequest;

      expect(response.status).toBe(204);
    });

    it("allows the frontend POST preflight without authentication cookies", async () => {
      const response = await request(createApp())
        .options("/conversations/1/messages")
        .set("Origin", env.frontendOrigin)
        .set("Access-Control-Request-Method", "POST")
        .set("Access-Control-Request-Headers", "Content-Type");

      expect(response.status).toBe(204);
      expect(response.headers["access-control-allow-origin"]).toBe(env.frontendOrigin);
    });
  });
});
