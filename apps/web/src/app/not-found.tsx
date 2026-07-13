import { AppShell } from "@/components/shell";

export default function NotFound() {
  return (
    <AppShell>
      <div className="grid min-h-screen place-items-center px-4 pt-14">
        <div className="text-center">
          <div className="text-sm text-[var(--rr-muted)]">404</div>
          <h1 className="mt-2 text-2xl font-semibold">Route not found</h1>
        </div>
      </div>
    </AppShell>
  );
}
