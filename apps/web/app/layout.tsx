import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Meetra",
  description: "Find study partners and exchange skills with other students.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
