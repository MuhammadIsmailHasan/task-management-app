import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { pageTitle, panelTitle } from "@/lib/titles";

describe("document titles (Property 59)", () => {
  it("puts the brand first and cuts long names", () => {
    expect(pageTitle("Alpha Board")).toBe("RevoBoard | Alpha Board");
    expect(pageTitle("")).toBe("RevoBoard");
    fc.assert(fc.property(fc.string(), (n) => {
      const t = pageTitle(n);
      return (t === "RevoBoard" || t.startsWith("RevoBoard | ")) && t.length <= 72 && !/[\n\r]/.test(t);
    }));
  });
  it("shows the unread count only above zero", () => {
    expect(panelTitle("inbox", 3)).toBe("RevoBoard | Inbox (3)");
    expect(panelTitle("inbox", 0)).toBe("RevoBoard | Inbox");
    expect(panelTitle("activity", 5)).toBe("RevoBoard | Activity");
  });
});
