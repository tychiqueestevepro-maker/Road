import React from "react";

export function StatusDot({ status = "online", className = "" }: { status?: "online" | "offline" | "warning"; className?: string }) {
  const colors = {
    online: "bg-green-500",
    offline: "bg-slate-400",
    warning: "bg-amber-500",
  };

  return (
    <span className={`relative flex h-2.5 w-2.5 ${className}`}>
      {status === "online" && (
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
      )}
      <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${colors[status]}`}></span>
    </span>
  );
}
