import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { AuthProvider } from "../contexts/AuthContext";
import { InternalAdminLogin } from "./InternalAdminLogin";

const loginMock = vi.hoisted(() => vi.fn());
const refreshMock = vi.hoisted(() => vi.fn());
const logoutMock = vi.hoisted(() => vi.fn());

vi.mock("../api/client", () => ({
  login: loginMock,
  refresh: refreshMock,
  logout: logoutMock,
}));

function LocationProbe() {
  const location = useLocation();
  return <div>Current route: {location.pathname}</div>;
}

function renderLogin(initialEntries: Array<string | { pathname: string; state?: unknown }>) {
  return render(
    <AuthProvider>
      <MemoryRouter initialEntries={initialEntries}>
        <Routes>
          <Route path="/login" element={<InternalAdminLogin />} />
          <Route path="*" element={<LocationProbe />} />
        </Routes>
      </MemoryRouter>
    </AuthProvider>,
  );
}

describe("InternalAdminLogin", () => {
  beforeEach(() => {
    refreshMock.mockReset();
    refreshMock.mockResolvedValue({ user: null });
    loginMock.mockReset();
    logoutMock.mockReset();
  });

  it("redirects to the requested admin route after a successful admin login", async () => {
    loginMock.mockResolvedValue({
      user: {
        email: "ops@cloverbooks.com",
        role: "superadmin",
        is_admin: true,
      },
    });

    renderLogin([{ pathname: "/login", state: { from: "/approvals" } }]);

    fireEvent.click(await screen.findByRole("button", { name: /Enter control tower/i }));

    expect(await screen.findByText("Current route: /approvals")).toBeInTheDocument();
  });

  it("shows an access error when the signed-in user is not an admin", async () => {
    loginMock.mockResolvedValue({
      user: {
        email: "user@cloverbooks.com",
        role: "customer",
      },
    });

    renderLogin(["/login"]);

    fireEvent.click(await screen.findByRole("button", { name: /Enter control tower/i }));

    expect(
      await screen.findByText(/You don't have access to the admin workspace\./i),
    ).toBeInTheDocument();
  });
});
