import { getSiteContent } from "@/lib/store";
import { saveSettingsAction } from "../../actions";

export default async function AdminSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string }>;
}) {
  const content = await getSiteContent();
  const { ok } = await searchParams;

  return (
    <div>
      <h1 className="text-2xl text-foreground">Settings</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        This is the demo&apos;s only real content — just here so a &quot;content&quot; backup has
        something to capture.
      </p>

      {ok && <p className="mt-4 rounded-lg border border-accent/40 bg-surface px-4 py-2 text-sm text-accent">Saved.</p>}

      <form action={saveSettingsAction} className="mt-6 flex max-w-md flex-col gap-4">
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="text-muted-foreground">Site name</span>
          <input
            name="siteName"
            defaultValue={content.siteName}
            required
            className="rounded-lg border border-border-soft bg-background px-3 py-2 text-foreground outline-none focus:border-accent"
          />
        </label>
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="text-muted-foreground">Tagline</span>
          <input
            name="tagline"
            defaultValue={content.tagline}
            className="rounded-lg border border-border-soft bg-background px-3 py-2 text-foreground outline-none focus:border-accent"
          />
        </label>
        <button
          type="submit"
          className="tactile mt-2 w-fit rounded-lg border border-border-soft bg-surface-2 px-4 py-2 text-sm font-medium text-foreground"
        >
          Save
        </button>
      </form>
    </div>
  );
}
