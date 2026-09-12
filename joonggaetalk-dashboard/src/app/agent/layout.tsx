import type { Metadata } from "next";
import { AppShell } from "@/components/layout/AppShell";

export const metadata: Metadata = { title: "중개사 대시보드" };

export default function AgentLayout({ children }: { children: React.ReactNode }) {
  return <AppShell role="agent">{children}</AppShell>;
}
