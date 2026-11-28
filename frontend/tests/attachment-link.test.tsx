import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ATTACHMENT_TILE, AttachmentLink } from "@/components/card/AttachmentLink";

const long = `https://docs.google.com/spreadsheets/d/${"x".repeat(120)}/edit`;

describe("AttachmentLink", () => {
  it("shows a link with its host and keeps a long name on one shortened line", () => {
    render(<li className={ATTACHMENT_TILE}><AttachmentLink attachment={{ url: long, file_url: null, name: long, mime_type: null }} /></li>);
    const link = screen.getByRole("link");
    expect(link).toHaveAttribute("href", long);
    expect(link).toHaveClass("min-w-0");
    expect(screen.getByText("docs.google.com")).toBeInTheDocument();
    expect(screen.getByText(long)).toHaveClass("truncate");
  });

  it("labels a file with its type", () => {
    render(<AttachmentLink attachment={{ url: null, file_url: "/api/files/a?exp=1&sig=s", name: "brief.pdf", mime_type: "application/pdf" }} />);
    expect(screen.getByText("File · application/pdf")).toBeInTheDocument();
  });
});
