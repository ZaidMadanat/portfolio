// The admin sidebar, in spec §7 order. Later admin tasks add the pages.
export const ADMIN_NAV = [
  { label: "Dashboard", href: "/admin" },
  { label: "Posts", href: "/admin/posts" },
  { label: "Reviews", href: "/admin/reviews" },
  { label: "Favourites", href: "/admin/favourites" },
  { label: "Photo library", href: "/admin/media" },
  { label: "Templates", href: "/admin/templates" },
  { label: "Subscribers", href: "/admin/subscribers" },
] as const;

export function isActiveAdminPath(pathname: string, href: string): boolean {
  return href === "/admin" ? pathname === "/admin" : pathname === href || pathname.startsWith(`${href}/`);
}
