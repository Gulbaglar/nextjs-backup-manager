// Every admin page redirects based on account/session state, which cannot be known at build time.
// If this segment is ever statically optimized, a build done before an admin account exists can
// freeze /admin/login's "no account yet -> /admin/setup" redirect into a cached response — so
// after you create the account, /admin/setup correctly sends you to /admin/login, but the stale
// cached /admin/login response sends you right back to /admin/setup. Forever. (Ask us how we know.)
export const dynamic = "force-dynamic";

export default function AdminRootLayout({ children }: { children: React.ReactNode }) {
  return children;
}
