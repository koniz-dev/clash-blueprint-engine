import type { Metadata } from "next";
import type { ReactNode } from "react";
import "@clash/ui/styles.css";

export const metadata: Metadata = {
  title: "Clash Blueprint Engine",
  description: "Design, validate, analyze and simulate village layouts.",
};

export default function RootLayout({ children }: { children: ReactNode }): JSX.Element {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
