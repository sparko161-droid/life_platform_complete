import type { ReactNode } from "react";
import { primaryNavFor } from "@life/ui";
import "./globals.css";

export const metadata = {
  title: "Мой день",
  description: "Детский раздел",
};

/**
 * Child shell (P1-010). Same contract-derived nav as the parent app,
 * but bottom-anchored with larger targets: docs/ux/screen-map.md
 * describes the child surface as a bottom nav, and
 * docs/ux/ui-architecture.md requires generous touch targets.
 */
export default function RootLayout({ children }: { children: ReactNode }) {
  const nav = primaryNavFor("child");
  return (
    <html lang="ru">
      <body>
        <div className="mx-auto flex min-h-screen w-full max-w-2xl flex-col">
          <main className="flex-1 p-4 pb-24 text-child-base">{children}</main>
          <nav
            aria-label="Основная навигация"
            className="fixed inset-x-0 bottom-0 mx-auto flex max-w-2xl justify-around border-t border-ink-muted/15 bg-surface p-2"
          >
            {nav.map((item) => (
              <a
                key={item.screenId}
                href={item.route}
                className="flex min-h-touch-child flex-1 items-center justify-center rounded-control px-3 text-center font-medium text-ink-muted hover:bg-surface-muted hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
              >
                {item.label}
              </a>
            ))}
          </nav>
        </div>
      </body>
    </html>
  );
}
