import type { ReactNode } from "react";
import { primaryNavFor } from "@life/ui";
import "./globals.css";

export const metadata = {
  title: "Семья — родитель",
  description: "Родительский раздел",
};

/**
 * Parent shell (P1-010). The nav is derived from the frozen screen
 * contracts via `primaryNavFor("parent")` -- adding a primaryNav screen
 * to packages/ux-contracts makes it appear here with no edit to this
 * file, which is the point.
 */
export default function RootLayout({ children }: { children: ReactNode }) {
  const nav = primaryNavFor("parent");
  return (
    <html lang="ru">
      <body>
        <div className="mx-auto flex min-h-screen w-full max-w-5xl flex-col">
          <header className="border-b border-ink-muted/15 bg-surface">
            <nav aria-label="Основная навигация" className="flex flex-wrap gap-1 p-3">
              {nav.map((item) => (
                <a
                  key={item.screenId}
                  href={item.route}
                  className="min-h-touch rounded-control px-3 py-2 text-sm font-medium text-ink-muted hover:bg-surface-muted hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
                >
                  {item.label}
                </a>
              ))}
            </nav>
          </header>
          <main className="flex-1 p-4">{children}</main>
        </div>
      </body>
    </html>
  );
}
