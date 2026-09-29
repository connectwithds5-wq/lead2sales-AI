import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Lead2Sales AI",
  description: "Turn incoming leads into organized sales opportunities."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}