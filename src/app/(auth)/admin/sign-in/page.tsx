import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { SignInPanel } from "@/features/admin/SignInPanel";
import { e2eAuthEnabled, githubConfigured } from "@/lib/auth";
import { getAdmin } from "@/lib/require-admin";

// /admin/sign-in. It sits in the (auth) group, outside admin/layout.tsx, so the
// admin guard never wraps it. Dynamic (session + ?error=); never public.
export const metadata: Metadata = {
  title: "Admin sign-in",
  robots: { index: false, follow: false },
};

export default async function SignInPage({ searchParams }: PageProps<"/admin/sign-in">) {
  if (await getAdmin()) redirect("/admin");
  const { error } = await searchParams;

  return (
    <main id="main" className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 py-10">
      <Card className="flex flex-col gap-5 p-6 sm:p-8">
        <div className="flex flex-col gap-2">
          <h1 className="font-display text-3xl font-extrabold">Admin sign-in</h1>
          <p className="text-muted">This part of the site is just for Zaid.</p>
        </div>
        <SignInPanel
          github={githubConfigured()}
          e2e={e2eAuthEnabled}
          initialError={typeof error === "string" ? error : null}
        />
        <Link href="/" className="inline-flex min-h-11 items-center self-start font-semibold underline">
          Back to the site
        </Link>
      </Card>
    </main>
  );
}
