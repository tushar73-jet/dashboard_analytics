import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Fashion Pur India — Instagram Analytics",
  description:
    "Analytics dashboard for @fashionpurindia — track engagement, find what works, and grow your audience.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
