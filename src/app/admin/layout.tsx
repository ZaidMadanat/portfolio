import type { Metadata } from "next";
import { Sidebar } from "@/features/admin/Sidebar";
import { getAdmin, requireAdmin } from "@/lib/require-admin";

// Every /admin page except sign-in (which lives in the (auth) group so this
// guard never wraps it). Dynamic: it reads the session on every request.
export const metadata: Metadata = {
  title: { default: "Admin", template: "%s · Admin" },
  robots: { index: false, follow: false },
};

export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  await requireAdmin();
  const admin = await getAdmin();

  return (
    <div className="flex flex-1 flex-col md:flex-row">
      <a
        href="#main"
        className="sr-only rounded-full border-2 border-ink bg-surface px-4 py-2 font-semibold focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:z-50"
      >
        Skip to content
      </a>
      <Sidebar name={admin?.name || admin?.email || ""} />
      <main id="main" className="w-full min-w-0 flex-1 px-4 py-8 sm:px-8 md:py-10">
        {children}
      </main>
    </div>
  );
}
