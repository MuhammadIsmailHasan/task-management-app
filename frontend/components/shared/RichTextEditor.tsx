"use client";

import { Editor } from "@tinymce/tinymce-react";
import { useMemo } from "react";

interface RichTextEditorProps {
  id?: string;
  label: string;
  value: string;
  onChange: (html: string) => void;
  onBlur?: () => void;
  placeholder?: string;
  disabled?: boolean;
}

const shielded = new WeakSet<Element>();

function shieldFloatingUi() {
  for (const aux of Array.from(document.querySelectorAll(".tox-tinymce-aux"))) {
    if (shielded.has(aux)) continue;
    shielded.add(aux);
    for (const type of ["focusin", "focusout"]) aux.addEventListener(type, (event) => event.stopPropagation());
  }
}

function token(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

export function RichTextEditor({ id, label, value, onChange, onBlur, placeholder, disabled }: RichTextEditorProps) {
  const contentStyle = useMemo(() => {
    if (typeof window === "undefined") return "";
    return [
      `body{font-family:${token("--font-stack")};font-size:${token("--text-sm")};line-height:${token("--text-sm-lh")};color:${token("--ink")};margin:${token("--space-3")} ${token("--space-4")};}`,
      `p,ul,ol,blockquote,pre{margin:0 0 ${token("--space-2")};}`,
      `h2{font-size:${token("--text-page-title")};margin:0 0 ${token("--space-2")};}`,
      `h3{font-size:${token("--text-base")};margin:0 0 ${token("--space-2")};}`,
      `a{color:${token("--accent")};}`,
      `blockquote{border-left:${token("--border-width-focus")} solid ${token("--border")};padding-left:${token("--space-3")};color:${token("--ink-muted")};}`,
      `.mce-content-body[data-mce-placeholder]:not(.mce-visualblocks)::before{color:${token("--ink-faint")};}`,
    ].join("");
  }, []);
  const minHeight = typeof window === "undefined" ? 0 : parseFloat(token("--size-textarea")) * 2;

  return (
    <Editor
      id={id}
      tinymceScriptSrc="/tinymce/tinymce.min.js"
      licenseKey="gpl"
      value={value}
      disabled={disabled}
      onInit={() => shieldFloatingUi()}
      onEditorChange={(html) => onChange(html)}
      onBlur={() => onBlur?.()}
      init={{
        menubar: false,
        statusbar: false,
        branding: false,
        promotion: false,
        plugins: "lists link autolink autoresize",
        toolbar: "blocks | bold italic underline strikethrough | bullist numlist | link blockquote | removeformat",
        block_formats: "Paragraph=p; Heading=h2; Subheading=h3",
        valid_elements: "p,br,strong/b,em/i,u,s,ul,ol,li,a[href|title|target|rel],h2,h3,blockquote,code,pre",
        link_default_target: "_blank",
        link_assume_external_targets: "https",
        min_height: minHeight,
        autoresize_bottom_margin: 0,
        placeholder,
        content_style: contentStyle,
        iframe_aria_text: label,
      }}
    />
  );
}
