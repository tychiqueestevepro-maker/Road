"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_SECTIONS = [
  {
    title: "Get Started",
    items: [
      { label: "Introduction", href: "/docs" },
      { label: "Quickstart", href: "/docs/quickstart" },
      { label: "Authentication", href: "/docs/authentication" }
    ]
  },
  {
    title: "Core Concepts",
    items: [
      { label: "Road State", href: "/docs/road-state" },
      { label: "Discrepancies", href: "/docs/discrepancies" },
      { label: "Evidence", href: "/docs/evidence" },
      { label: "Sources and Freshness", href: "/docs/sources" }
    ]
  },
  {
    title: "API",
    items: [
      { label: "Discrepancies", href: "/docs/api-reference#discrepancies" },
      { label: "Road State", href: "/docs/api-reference#road-state" },
      { label: "Events", href: "/docs/api-reference#events" },
      { label: "Evidence", href: "/docs/api-reference#evidence" },
      { label: "Sources", href: "/docs/api-reference#sources" }
    ]
  },
  {
    title: "Reference",
    items: [
      { label: "API Reference", href: "/docs/api-reference" },
      { label: "Errors", href: "/docs/errors" },
      { label: "Webhooks", href: "/docs/webhooks" }
    ]
  }
];

export function DocsNav() {
  const pathname = usePathname();

  return (
    <aside className="docs-sidebar">
      {NAV_SECTIONS.map((section) => (
        <div key={section.title} className="docs-nav-section">
          <h4 className="docs-nav-heading">{section.title}</h4>
          <ul className="docs-nav-list">
            {section.items.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={`docs-nav-link ${pathname === item.href ? "docs-nav-active" : ""}`}
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </aside>
  );
}
