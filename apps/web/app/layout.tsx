import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Meetra",
  description: "Temukan teman belajar dan bertukar skill dengan sesama mahasiswa.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="id"><body>{children}</body></html>;
}
