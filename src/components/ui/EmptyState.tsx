import Link from "next/link";

type EmptyStateProps = {
  title: string;
  onClear?: () => void;
  clearHref?: string;
};

const CLEAR =
  "inline-flex min-h-11 items-center justify-center rounded-xl border-2 border-ink bg-accent px-5 py-2.5 font-bold text-on-accent shadow-hard";

export function EmptyState({ title, onClear, clearHref }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center gap-4 rounded-3xl border-2 border-dashed border-line px-6 py-12 text-center">
      <p className="font-display text-2xl font-bold">{title}</p>
      {clearHref ? (
        <Link href={clearHref} className={CLEAR}>
          Clear filters
        </Link>
      ) : onClear ? (
        <button type="button" onClick={onClear} className={`${CLEAR} cursor-pointer`}>
          Clear filters
        </button>
      ) : null}
    </div>
  );
}
