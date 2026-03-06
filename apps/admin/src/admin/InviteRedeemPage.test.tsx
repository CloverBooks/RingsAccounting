import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { InviteRedeemPage } from "./InviteRedeemPage";

function renderInviteRoute(path = "/invite/token-123") {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/invite/:token" element={<InviteRedeemPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("InviteRedeemPage", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("renders the invite form for a valid invite", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          valid: true,
          role: "Finance",
          email: "invitee@cloverbooks.com",
          email_locked: true,
        }),
      ),
    ) as unknown as typeof fetch;

    renderInviteRoute();

    expect(await screen.findByText(/Join Clover Books Admin/i)).toBeInTheDocument();
    expect(screen.getByDisplayValue("invitee@cloverbooks.com")).toBeDisabled();
    expect(screen.getByText(/This invite is for this email address only\./i)).toBeInTheDocument();
  });

  it("renders the invalid invite state when validation fails", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ valid: false, error: "Invite expired." })),
    ) as unknown as typeof fetch;

    renderInviteRoute();

    expect(await screen.findByText(/Invalid Invite/i)).toBeInTheDocument();
    expect(screen.getByText(/Invite expired\./i)).toBeInTheDocument();
  });

  it("submits the redemption form and shows the success state", async () => {
    globalThis.fetch = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            valid: true,
            role: "Finance",
            email: "invitee@cloverbooks.com",
            email_locked: false,
          }),
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            message: "Account created successfully.",
            redirect: "/login",
          }),
        ),
      ) as unknown as typeof fetch;

    const view = renderInviteRoute();

    await screen.findByText(/Join Clover Books Admin/i);

    fireEvent.change(screen.getByPlaceholderText("Jane"), { target: { value: "Jane" } });
    fireEvent.change(screen.getByPlaceholderText("Doe"), { target: { value: "Doe" } });
    fireEvent.change(screen.getByPlaceholderText("janedoe"), { target: { value: "janedoe" } });
    fireEvent.change(screen.getByPlaceholderText("jane@cernbooks.com"), {
      target: { value: "jane@cloverbooks.com" },
    });
    const passwordInputs = view.container.querySelectorAll<HTMLInputElement>('input[type="password"]');
    fireEvent.change(passwordInputs[0], { target: { value: "securepass123" } });
    fireEvent.change(passwordInputs[1], { target: { value: "securepass123" } });
    fireEvent.click(screen.getByRole("button", { name: /Create account/i }));

    expect(await screen.findByText(/Account Created!/i)).toBeInTheDocument();
    expect(screen.getByText(/Account created successfully\./i)).toBeInTheDocument();
    expect(globalThis.fetch).toHaveBeenCalledTimes(2);
  });
});
