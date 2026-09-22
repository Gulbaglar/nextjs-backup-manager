import { redirect } from "next/navigation";
import { isSetupComplete } from "@/lib/admin-store";
import { setupAction } from "../actions";

// Depends on cookies()/redirect() indirectly through the account-state check below, so this must
// never be statically rendered — otherwise a build done before any account exists would freeze
// this page's "no account yet" branch forever, even after an account is created. See the README's
// "Deploying" section for the ERR_TOO_MANY_REDIRECTS pitfall this guards against.
export const dynamic = "force-dynamic";

export default async function AdminSetupPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  if (await isSetupComplete()) redirect("/admin/login");
  const { error } = await searchParams;

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6">
      <div className="w-full max-w-sm rounded-xl border border-border-soft bg-surface p-8">
        <p className="font-mono text-xs uppercase tracking-[0.3em] text-accent">First-time setup</p>
        <h1 className="mt-3 text-2xl text-foreground">Create an admin account</h1>
        <p className="mt-2 text-sm text-muted-foreground">Choose a username and password to manage this site.</p>

        {error && (
          <p className="mt-4 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-2 text-sm text-destructive">
            {error}
          </p>
        )}

        <form action={setupAction} className="mt-6 flex flex-col gap-4">
          <Field label="Username" name="username" autoComplete="username" />
          <Field label="Password" name="password" type="password" autoComplete="new-password" />
          <Field label="Confirm password" name="confirm" type="password" autoComplete="new-password" />
          <button
            type="submit"
            className="tactile mt-2 rounded-lg border border-border-soft bg-surface-2 px-4 py-2.5 text-sm font-medium text-foreground"
          >
            Create account
          </button>
        </form>
      </div>
    </div>
  );
}

function Field({ label, name, type = "text", autoComplete }: { label: string; name: string; type?: string; autoComplete?: string }) {
  return (
    <label className="flex flex-col gap-1.5 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <input
        name={name}
        type={type}
        autoComplete={autoComplete}
        required
        className="rounded-lg border border-border-soft bg-background px-3 py-2 text-foreground outline-none focus:border-accent"
      />
    </label>
  );
}
