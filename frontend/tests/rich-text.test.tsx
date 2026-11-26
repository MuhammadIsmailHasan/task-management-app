import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { RichText } from "@/components/shared/RichText";
import { htmlToText, safeHtml } from "@/lib/rich-text";

describe("rich text (DS-29, round 6)", () => {
  it("turns a description into plain words for previews and search", () => {
    expect(htmlToText("<p>One &amp; two</p><ul><li>three</li></ul>")).toBe("One & two three");
    expect(htmlToText("<p></p>")).toBe("");
    expect(htmlToText(null)).toBe("");
  });

  it("drops anything outside the allowlist before it is shown", () => {
    const out = safeHtml('<p onclick="x()">a<script>alert(1)</script></p><img src=x onerror=y><a href="javascript:z()">l</a>');
    expect(out).not.toMatch(/script|onclick|onerror|<img|javascript:/);
    expect(out).toContain("<p>a</p>");
  });

  it("renders formatting, and the empty line when there is nothing to show", async () => {
    const { container, rerender } = render(<RichText html="<p>Hi <strong>there</strong></p>" />);
    await waitFor(() => expect(container.querySelector(".rich-text strong")).toHaveTextContent("there"));
    rerender(<RichText html="<p></p>" />);
    expect(screen.getByText("No description.")).toBeInTheDocument();
  });
});

import { insideEditorUi } from "@/components/ui/dialog";

describe("TinyMCE floating UI inside a modal (round 7)", () => {
  it("recognises the editor's dialogs and menus, so the modal neither closes nor steals focus", () => {
    const aux = document.createElement("div");
    aux.className = "tox-tinymce-aux";
    const input = document.createElement("input");
    aux.appendChild(input);
    document.body.appendChild(aux);
    expect(insideEditorUi(input)).toBe(true);
    expect(insideEditorUi(document.body)).toBe(false);
    expect(insideEditorUi(null)).toBe(false);
    aux.remove();
  });
});
