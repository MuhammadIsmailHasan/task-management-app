"use client";

import { Upload } from "lucide-react";
import { useRef, useState } from "react";
import { cn } from "@/lib/utils";

const ACCEPTED = [".pdf", ".doc", ".docx", ".rar"];

interface FileDropZoneProps {
  onFile: (file: File) => void;
}

/** A dashed drop target: drag a file onto it, or click (or press Enter) to open the file picker. */
export function FileDropZone({ onFile }: FileDropZoneProps) {
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function take(file: File | undefined) {
    if (!file) return;
    if (!ACCEPTED.some((ext) => file.name.toLowerCase().endsWith(ext))) {
      setError("Only PDF, Word or RAR files are accepted.");
      return;
    }
    setError(null);
    onFile(file);
  }

  return (
    <div className="flex flex-col gap-2">
      <div
        role="button"
        tabIndex={0}
        aria-label="Drop a file or browse"
        onClick={() => input.current?.click()}
        onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), input.current?.click())}
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          take(e.dataTransfer.files?.[0]);
        }}
        className={cn(
          "rule-dashed flex min-h-dropzone cursor-pointer flex-col items-center justify-center gap-2 rounded-ui border border-line px-3 text-center text-sm text-ink-muted transition-colors duration-fast focus-ring",
          over && "border-brand bg-brand-tint text-brand",
        )}
      >
        <Upload className="size-icon" aria-hidden="true" />
        <span>Drop a file here or browse · PDF, Word or RAR</span>
      </div>
      <input
        ref={input}
        type="file"
        hidden
        accept={ACCEPTED.join(",")}
        aria-label="Upload file"
        onChange={(e) => {
          take(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
      {error && (
        <p role="alert" className="text-xs text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
