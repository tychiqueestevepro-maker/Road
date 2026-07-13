import type { Metadata } from "next";
import { DeveloperHeader } from "@/components/marketing/developer-header";
import { DocsShell } from "@/components/docs/docs-shell";

export const metadata: Metadata = {
  title: "Documentation — Verytis",
  description: "Verytis API documentation. Access standardized road-state intelligence."
};

export default function DocsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-[#F8FAFC]">
      <DeveloperHeader />
      <DocsShell>
        {children}
      </DocsShell>
    </div>
  );
}
