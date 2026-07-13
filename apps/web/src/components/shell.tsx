import Link from "next/link";
import { Activity, Camera, Database, Gauge, Terminal } from "lucide-react";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-[var(--rr-bg)] text-[var(--rr-text)]">
      <nav className="fixed left-0 top-0 z-30 flex h-14 w-full items-center justify-between border-b border-[var(--rr-border)] bg-white/95 px-4 backdrop-blur">
        <Link href="/" className="flex items-center gap-3">
          <span className="grid size-8 place-items-center rounded-md border border-[var(--rr-border)] bg-[var(--rr-panel-2)]">
            <Gauge className="size-4 text-[var(--rr-cyan)]" />
          </span>
          <span className="text-sm font-semibold tracking-normal">VERYTIS</span>
          <span className="rounded-md border border-[var(--rr-green)]/25 bg-[var(--rr-green)]/10 px-2 py-0.5 text-xs font-medium text-[var(--rr-green)]">
            LIVE
          </span>
        </Link>
        <div className="flex items-center gap-1">
          <Link className="nav-button" href="/">
            <Activity className="size-4" />
            <span>Ops</span>
          </Link>
          <Link className="nav-button" href="/sources">
            <Database className="size-4" />
            <span>Sources</span>
          </Link>
          <Link className="nav-button" href="/cameras">
            <Camera className="size-4" />
            <span>Cameras</span>
          </Link>
          <Link className="nav-button" href="/developers">
            <Terminal className="size-4" />
            <span>Developers</span>
          </Link>
        </div>
      </nav>
      {children}
    </main>
  );
}
