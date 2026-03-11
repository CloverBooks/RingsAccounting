import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { vi } from "vitest";
import { FeatureFlagsSection } from "./FeatureFlagsSection";
import * as api from "./api";

function createMockFlags() {
  return [
    {
      id: 1,
      key: "new-ui",
      label: "New UI",
      description: "Toggle new UI",
      is_enabled: false,
      rollout_percent: 100,
      created_at: "2024-01-01T00:00:00Z",
      updated_at: "2024-01-01T00:00:00Z",
    },
  ];
}

vi.mock("./api", () => {
  const mockFlags = createMockFlags();
  return {
    fetchFeatureFlags: vi.fn().mockResolvedValue(mockFlags),
    updateFeatureFlag: vi.fn().mockResolvedValue({ ...mockFlags[0], is_enabled: true }),
  };
});

describe("FeatureFlagsSection", () => {
  it("renders flags and toggles update", async () => {
    render(<FeatureFlagsSection role="superadmin" />);
    await waitFor(() => expect(screen.getByText(/new-ui/i)).toBeInTheDocument());
    const checkbox = screen.getByRole("checkbox");
    fireEvent.click(checkbox);
    await waitFor(() => {
      expect(api.updateFeatureFlag).toHaveBeenCalled();
    });
  });

  it("collects a reason in-app when the backend requires one", async () => {
    const updateFeatureFlag = api.updateFeatureFlag as unknown as vi.Mock;
    updateFeatureFlag
      .mockRejectedValueOnce({ message: "Reason is required for this change." })
      .mockResolvedValueOnce({
        ...createMockFlags()[0],
        is_enabled: true,
      });

    render(<FeatureFlagsSection role="superadmin" />);
    await waitFor(() => expect(screen.getByText(/new-ui/i)).toBeInTheDocument());

    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.change(await screen.findByLabelText(/reason/i), {
      target: { value: "Controlled rollout for operations." },
    });
    fireEvent.click(screen.getByRole("button", { name: /apply change/i }));

    await waitFor(() =>
      expect(updateFeatureFlag).toHaveBeenLastCalledWith(1, {
        is_enabled: true,
        reason: "Controlled rollout for operations.",
      }),
    );
  });
});
