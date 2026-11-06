import { NextResponse, type NextRequest } from "next/server";

const API = process.env.API_INTERNAL_URL ?? "http://127.0.0.1:8000";

export function proxy(req: NextRequest) {
  const { pathname, search } = req.nextUrl;

  // Same-origin API: /api/foo -> http://api:8000/foo (keeps the session cookie first-party).
  if (pathname.startsWith("/api/")) {
    return NextResponse.rewrite(new URL(`${pathname.slice(4)}${search}`, API));
  }

  // Cheap gate for pages; the API still checks the session on every request.
  if (pathname !== "/login" && !req.cookies.has("jt_session")) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.search = pathname === "/" ? "" : `?next=${encodeURIComponent(pathname)}`;
    return NextResponse.redirect(url);
  }
}

export const config = {
  matcher: ["/((?!_next/|icon\\.svg|manifest\\.webmanifest|favicon\\.ico|robots\\.txt).*)"],
};
