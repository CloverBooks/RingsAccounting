import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AuthProvider, useAuth } from "./AuthContext";

const loginMock = vi.hoisted(() => vi.fn());
const refreshMock = vi.hoisted(() => vi.fn());
const logoutMock = vi.hoisted(() => vi.fn());

vi.mock("../api/client", () => ({
  login: loginMock,
  refresh: refreshMock,
  logout: logoutMock,
}));

const TestHarness = () => {
  const { auth, logout } = useAuth();
  return (
    <div>
      <span data-testid="auth-state">{auth.authenticated ? "auth" : "anon"}</span>
      <span data-testid="auth-email">{auth.user?.email || "none"}</span>
      <span data-testid="bootstrapped">{auth.bootstrapped ? "ready" : "pending"}</span>
      <button onClick={logout}>Logout</button>
    </div>
  );
};

describe("AuthContext", () => {
  let originalLocation: Location;
  let originalLocalStorage: Storage;
  let storageBacking = new Map<string, string>();
  const clearSnapshot = () => {
    const storage = window.localStorage;
    if (storage && typeof storage.removeItem === "function") {
      storage.removeItem("auth_snapshot_v1");
      storage.removeItem("auth_token");
      storage.removeItem("user");
    }
  };

  beforeEach(() => {
    originalLocation = window.location;
    originalLocalStorage = window.localStorage;
    storageBacking = new Map<string, string>();
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      value: {
        getItem: (key: string) => (storageBacking.has(key) ? storageBacking.get(key)! : null),
        setItem: (key: string, value: string) => {
          storageBacking.set(key, value);
        },
        removeItem: (key: string) => {
          storageBacking.delete(key);
        },
      } satisfies Pick<Storage, "getItem" | "setItem" | "removeItem">,
    });
    clearSnapshot();
    loginMock.mockReset();
    refreshMock.mockReset();
    logoutMock.mockReset();

    // @ts-expect-error test override
    delete window.location;
    // @ts-expect-error test override
    window.location = { assign: vi.fn() } as Location;
  });

  afterEach(() => {
    clearSnapshot();
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      value: originalLocalStorage,
    });
    window.location = originalLocation;
    vi.clearAllMocks();
  });

  it("renders logout button after refresh succeeds", async () => {
    refreshMock.mockResolvedValue({
      access_token: "token",
      token_type: "bearer",
      user: { email: "user@example.com" },
    });

    render(
      <AuthProvider>
        <TestHarness />
      </AuthProvider>,
    );

    await waitFor(() => expect(screen.getByTestId("auth-state").textContent).toBe("auth"));
    expect(screen.getByText("Logout")).toBeInTheDocument();
    expect(screen.getByTestId("bootstrapped").textContent).toBe("ready");
  });

  it("boots from a cached snapshot before refresh resolves", async () => {
    let resolveRefresh: ((value: any) => void) | undefined;
    refreshMock.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveRefresh = resolve;
        }),
    );
    window.localStorage.setItem(
      "auth_snapshot_v1",
      JSON.stringify({
        savedAt: Date.now(),
        user: { email: "cached@example.com", name: "Cached User" },
      }),
    );

    render(
      <AuthProvider>
        <TestHarness />
      </AuthProvider>,
    );

    expect(screen.getByTestId("auth-state").textContent).toBe("auth");
    expect(screen.getByTestId("auth-email").textContent).toBe("cached@example.com");
    expect(screen.getByTestId("bootstrapped").textContent).toBe("pending");
    expect(refreshMock).toHaveBeenCalledTimes(1);

    resolveRefresh?.({
      access_token: "fresh-token",
      token_type: "bearer",
      user: { email: "fresh@example.com" },
    });

    await waitFor(() => expect(screen.getByTestId("bootstrapped").textContent).toBe("ready"));
    expect(screen.getByTestId("auth-email").textContent).toBe("fresh@example.com");
  });

  it("logout clears auth state and redirects to /login", async () => {
    refreshMock.mockResolvedValue({
      access_token: "token",
      token_type: "bearer",
      user: { email: "user@example.com" },
    });
    logoutMock.mockResolvedValue({ ok: true });

    render(
      <AuthProvider>
        <TestHarness />
      </AuthProvider>,
    );

    await waitFor(() => expect(screen.getByTestId("auth-state").textContent).toBe("auth"));
    fireEvent.click(screen.getByText("Logout"));

    await waitFor(() => expect(screen.getByTestId("auth-state").textContent).toBe("anon"));
    expect((window.location as any).assign).toHaveBeenCalledWith("/login");
    expect(window.localStorage.getItem("auth_snapshot_v1")).toBeNull();
  });
});
