import { EmptyState } from "@life/ui";

/** C-GAME-LOBBY (packages/ux-contracts). Shell only -- content lands with its own task. */
export default function Page() {
  return (
    <section aria-labelledby="page-title">
      <h1 id="page-title" className="mb-4 text-child-lg font-semibold text-ink">
        Игры
      </h1>
      <EmptyState surface="child" title="Пока пусто" description="Скоро здесь что-то появится." />
    </section>
  );
}
