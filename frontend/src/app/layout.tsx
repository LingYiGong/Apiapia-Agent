import type { Metadata } from "next";
import { AuthProvider } from "@/lib/auth";
import "./globals.css";

export const metadata: Metadata = {
  title: "Personal AI Assistant",
  description: "Personal AI Assistant with Decoupled LLMs and Long-term Mem0 Memory",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" className="dark">
      <body className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
