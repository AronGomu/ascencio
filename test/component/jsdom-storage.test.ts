// @vitest-environment jsdom

import { expect, it } from "vitest";

it("provides JSDOM storage globals without Node webstorage or manual flags", () => {
  expect(localStorage).toBeInstanceOf(Storage);
  expect(sessionStorage).toBeInstanceOf(Storage);
  expect(localStorage).not.toBe(sessionStorage);
  expect(localStorage.length).toBe(0);
  expect(sessionStorage.length).toBe(0);

  try {
    localStorage.setItem("storage-probe", "local");
    sessionStorage.setItem("storage-probe", "session");
    expect(localStorage.getItem("storage-probe")).toBe("local");
    expect(sessionStorage.getItem("storage-probe")).toBe("session");
    localStorage.clear();
    expect(localStorage.length).toBe(0);
    expect(sessionStorage.getItem("storage-probe")).toBe("session");
  } finally {
    localStorage.clear();
    sessionStorage.clear();
  }
});
