// The demo's own content — deliberately tiny. Replace this with your real site's content type;
// the Backup Manager only cares about `data/content.json`, `data/admin.json` and `public/uploads/`
// as three independent things it can back up together or separately, not about their shape.

export type SiteContent = {
  siteName: string;
  tagline: string;
};

export const defaultSiteContent: SiteContent = {
  siteName: "Demo Site",
  tagline: "Edit me from /admin/settings, then back me up.",
};
