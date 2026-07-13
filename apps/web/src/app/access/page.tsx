import React from "react";
import { DeveloperHeader } from "@/components/marketing/developer-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export const metadata = {
  title: "Get API Access | Verytis",
};

export default function AccessPage() {
  return (
    <div className="flex min-h-screen flex-col bg-white">
      <DeveloperHeader />
      <main className="flex flex-1 flex-col items-center justify-center p-6 pb-24">
        <div className="w-full max-w-[480px]">
          <h1 className="mb-3 text-[32px] font-bold tracking-tight text-slate-900">
            Get API access
          </h1>
          <p className="mb-10 text-[16px] leading-relaxed text-slate-500">
            Receive an API key and start testing Verytis.
          </p>

          <form action="/access/success" className="flex flex-col gap-5">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="company" className="text-[13px] font-semibold text-slate-900">
                Company name
              </label>
              <Input id="company" name="company" placeholder="Acme Corp" required />
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="email" className="text-[13px] font-semibold text-slate-900">
                Work email
              </label>
              <Input id="email" name="email" type="email" placeholder="jane@acmecorp.com" required />
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="usecase" className="text-[13px] font-semibold text-slate-900">
                Use case <span className="font-normal text-slate-400">(Optional)</span>
              </label>
              <Textarea id="usecase" name="usecase" placeholder="How do you plan to use Verytis?" />
            </div>

            <Button type="submit" className="mt-2 h-11 w-full text-[14px]">
              GET API ACCESS
            </Button>
          </form>
        </div>
      </main>
    </div>
  );
}
