import { expect, test } from "vitest";
import { allowConsole } from "./strictConsole";

test("allowConsole permits known warnings during targeted tests", () => {
  allowConsole("allowed warning");
  expect(() => console.warn("allowed warning")).not.toThrow();
});
