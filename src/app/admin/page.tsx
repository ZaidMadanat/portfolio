// The dashboard (spec §7). Task 22 fills in quick-create, stats, drafts and
// sync status; until then it's the greeting.
export default function AdminDashboard() {
  return (
    <section className="flex flex-col gap-3">
      <h1 className="font-display text-4xl font-extrabold">Morning, Zaid.</h1>
      <p className="text-muted">Posts, reviews and sync status will show up here.</p>
    </section>
  );
}
