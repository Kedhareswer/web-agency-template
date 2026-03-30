import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Source・AI Consutling &amp; Automations for Modern Teams",
  description: "Source® is a premium AI Agency &amp; Enterprise Website Template built for automation experts and tech firms. Designed in Framer, it blends sleek design with modern functionality to showcase your services, case studies, and expertise with clarity.\n",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
