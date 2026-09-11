import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "@/app.js";

describe("CORS", () => {
  it("allows credentialed requests from the frontend origin", async () => {
    const frontendOrigin = "http://localhost:5173";

    const response = await request(createApp()).get("/auth/me").set("Origin", frontendOrigin);

    expect(response.status).toBe(401);
    expect(response.headers["access-control-allow-origin"]).toBe(frontendOrigin);
    expect(response.headers["access-control-allow-origin"]).not.toBe("*");
    expect(response.headers["access-control-allow-credentials"]).toBe("true");
  });
});
