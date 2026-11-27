import { afterEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { SignJWT } from "jose";
import { middleware } from "./middleware";

afterEach(() => vi.unstubAllEnvs());

it("lets coaches reach their sent message history API but no other admin API", async () => {
  vi.stubEnv("ADMIN_SESSION_SECRET", "sent-messages-middleware-test");
  const token = await new SignJWT({ roles: ["coach"], defaultClubId: null })
    .setProtectedHeader({ alg: "HS256" }).setSubject("coach")
    .sign(new TextEncoder().encode("sent-messages-middleware-test"));
  const request = (path: string) => new NextRequest(`http://localhost${path}`, { headers: { cookie: `admin_session=${token}` } });
  expect((await middleware(request("/api/admin/sent-messages"))).status).toBe(200);
  expect((await middleware(request("/api/admin/sent-messages/filters?q=a"))).status).toBe(200);
  expect((await middleware(request("/api/admin/sent-messages-other"))).status).toBe(403);
  expect((await middleware(request("/api/admin/notifications/send-to-players"))).status).toBe(403);
});
