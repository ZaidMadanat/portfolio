type Props = { count: number; average: number | null; month: string };

// The two header tiles (spec §6.6): films logged this month, and their average
// displayed rating. Worked out when the page is built or revalidated.
export function FilmStats({ count, average, month }: Props) {
  const tile = "flex min-w-36 flex-col gap-1 rounded-[20px] border-2 border-ink px-5 py-4 text-ink";
  return (
    <ul aria-label="This month" className="flex flex-wrap gap-3">
      <li className={`${tile} bg-soft`}>
        <span className="font-display text-4xl leading-none font-extrabold">{count}</span>
        <span className="text-sm text-muted">{count === 1 ? "film" : "films"} in {month}</span>
      </li>
      <li className={`${tile} bg-soft2`}>
        <span className="font-display text-4xl leading-none font-extrabold">
          {average == null ? (
            <>
              <span aria-hidden="true">–</span>
              <span className="sr-only">None yet</span>
            </>
          ) : (
            average.toFixed(1)
          )}
        </span>
        <span className="text-sm text-muted">average rating</span>
      </li>
    </ul>
  );
}
