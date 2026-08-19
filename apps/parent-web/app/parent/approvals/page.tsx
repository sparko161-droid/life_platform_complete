import { EmptyState } from "@life/ui";

/** P-APPROVALS (packages/ux-contracts). Shell only -- content lands with its own task. */
export default function Page() {
  return (
    <section aria-labelledby="page-title">
      <h1 id="page-title" className="mb-4 text-xl font-semibold text-ink">
        Проверка
      </h1>
      <EmptyState title="Пока пусто" description="Этот раздел появится совсем скоро." />
    </section>
  );
}
