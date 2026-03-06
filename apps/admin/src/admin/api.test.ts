import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../api/client", () => ({
  getAccessToken: () => null,
}));

import { fetchUsers } from "./api";

const originalFetch = globalThis.fetch;

describe("admin api trace ids", () => {
  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("appends response header request ids to admin API failures", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ detail: "forbidden" }), {
        status: 403,
        headers: {
          "content-type": "application/json",
          "x-request-id": "admin-trace-01",
        },
      }),
    ) as typeof fetch;

    await expect(fetchUsers()).rejects.toMatchObject({
      status: 403,
      requestId: "admin-trace-01",
      message: "forbidden (Request ID: admin-trace-01)",
    });
  });

  it("falls back to JSON request ids when the response header is absent", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          message: "backend unavailable",
          request_id: "admin-trace-02",
        }),
        {
          status: 503,
          headers: {
            "content-type": "application/json",
          },
        },
      ),
    ) as typeof fetch;

    await expect(fetchUsers()).rejects.toMatchObject({
      status: 503,
      requestId: "admin-trace-02",
      message: "backend unavailable (Request ID: admin-trace-02)",
    });
  });
});
