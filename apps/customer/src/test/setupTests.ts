import "@testing-library/jest-dom";
import { configure } from "@testing-library/react";
import { vi } from "vitest";
import "./strictConsole";

configure({
  asyncUtilTimeout: 10000,
});

vi.mock("recharts", async () => {
  const actual = await vi.importActual<typeof import("recharts")>("recharts");
  const React = await import("react");

  function ResponsiveContainer({
    width = 1024,
    height = 320,
    children,
  }: {
    width?: number | string;
    height?: number | string;
    children?: React.ReactNode;
  }) {
    const resolvedWidth = typeof width === "number" ? width : 1024;
    const resolvedHeight = typeof height === "number" ? height : 320;
    const style = { width: resolvedWidth, height: resolvedHeight };

    if (!React.isValidElement(children)) {
      return React.createElement("div", { style }, children);
    }

    return React.createElement(
      "div",
      { style },
      React.cloneElement(children, {
        width: resolvedWidth,
        height: resolvedHeight,
      }),
    );
  }

  return {
    ...actual,
    ResponsiveContainer,
  };
});

class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}

if (!globalThis.ResizeObserver) {
  globalThis.ResizeObserver = ResizeObserverMock as typeof ResizeObserver;
}

const fixedRect = {
  x: 0,
  y: 0,
  top: 0,
  left: 0,
  right: 1024,
  bottom: 768,
  width: 1024,
  height: 768,
  toJSON() {
    return this;
  },
};

Object.defineProperty(HTMLElement.prototype, "offsetWidth", {
  configurable: true,
  get() {
    return 1024;
  },
});

Object.defineProperty(HTMLElement.prototype, "offsetHeight", {
  configurable: true,
  get() {
    return 768;
  },
});

Object.defineProperty(HTMLElement.prototype, "clientWidth", {
  configurable: true,
  get() {
    return 1024;
  },
});

Object.defineProperty(HTMLElement.prototype, "clientHeight", {
  configurable: true,
  get() {
    return 768;
  },
});

HTMLElement.prototype.getBoundingClientRect = function getBoundingClientRect(): DOMRect {
  return fixedRect as DOMRect;
};
