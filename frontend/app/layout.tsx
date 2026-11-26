import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "@fontsource-variable/inter";
import "@fontsource-variable/plus-jakarta-sans";
import "@/styles/globals.css";
import { BaseToaster } from "@/components/shared/BaseToaster";

export const metadata: Metadata = { title: { default: "RevoBoard", template: "RevoBoard | %s" }, description: "RevoBoard: kanban task management" };
export const viewport: Viewport = { width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        {children}
        <BaseToaster />
      </body>
    </html>
  );
}
