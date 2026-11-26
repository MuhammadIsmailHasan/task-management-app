import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

afterEach(() => cleanup());

// jsdom lacks these browser APIs that cmdk and Radix use.
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver ??= ResizeObserverStub as unknown as typeof ResizeObserver;
if (typeof Element !== "undefined") Element.prototype.scrollIntoView ??= () => {};

// The TinyMCE editor loads a script into an iframe, which jsdom cannot run: tests get a labelled textarea with the same contract.
import { createElement } from "react";
import { vi } from "vitest";
vi.mock("@/components/shared/RichTextEditor", () => ({
  RichTextEditor: ({ id, label, value, onChange, onBlur, disabled }: { id?: string; label: string; value: string; onChange: (v: string) => void; onBlur?: () => void; disabled?: boolean }) =>
    createElement("textarea", { id, "aria-label": label, value, disabled, onChange: (e: { target: { value: string } }) => onChange(e.target.value), onBlur }),
}));
