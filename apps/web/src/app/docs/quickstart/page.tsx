import { QuickstartTimeline } from "@/components/docs/quickstart-timeline";

export const metadata = {
  title: "Quickstart | Verytis",
};

export default function QuickstartPage() {
  return (
    <>
      <h1 className="mb-2 text-[38px] font-bold tracking-tight text-slate-900 md:text-[44px]">Quickstart</h1>
      <p className="mb-12 text-[16px] leading-relaxed text-slate-500">
        Make your first API request in less than 5 minutes.
      </p>
      
      <QuickstartTimeline />
    </>
  );
}
