import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { isSetupComplete } from "@/lib/admin-store";
import { SESSION_COOKIE, verifySessionCookieValue } from "@/lib/auth";
import { loginAction } from "../actions";

// See setup/page.tsx for why this must be force-dynamic.
export const dynamic = "force-dynamic";

export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  if (!(await isSetupComplete())) redirect("/admin/setup");
  const value = (await cookies()).get(SESSION_COOKIE)?.value;
  if (await verifySessionCookieValue(value)) redirect("/admin");
  const { error } = await searchParams;

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6">
      <div className="w-full max-w-sm rounded-xl border border-border-soft bg-surface p-8">
        <p className="font-mono text-xs uppercase tracking-[0.3em] text-accent">Admin</p>
        <h1 className="mt-3 text-2xl text-foreground">Sign in</h1>

        {error && (
          <p className="mt-4 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-2 text-sm text-destructive">
            {error}
          </p>
        )}

        <form action={loginAction} className="mt-6 flex flex-col gap-4">
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="text-muted-foreground">Username</span>
            <input
              name="username"
              type="text"
              autoComplete="username"
              required
              className="rounded-lg border border-border-soft bg-background px-3 py-2 text-foreground outline-none focus:border-accent"
            />
          </label>
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="text-muted-foreground">Password</span>
            <input
              name="password"
              type="password"
              autoComplete="current-password"
              required
              className="rounded-lg border border-border-soft bg-background px-3 py-2 text-foreground outline-none focus:border-accent"
            />
          </label>
          <button
            type="submit"
            className="tactile mt-2 rounded-lg border border-border-soft bg-surface-2 px-4 py-2.5 text-sm font-medium text-foreground"
          >
            Sign in
          </button>
        </form>
      </div>
    </div>
  );
}
