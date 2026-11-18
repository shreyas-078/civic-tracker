import NextAuth from "next-auth";
import { authConfig } from "./auth.config";
import { NextResponse } from "next/server";

const { auth } = NextAuth(authConfig);

export default auth((req) => {
  const { pathname } = req.nextUrl;

  const protectedRoutes = ["/map", "/report", "/profile", "/admin"];
  const adminRoutes     = ["/admin"];

  const isProtected = protectedRoutes.some((r) => pathname.startsWith(r));
  const isAdmin     = adminRoutes.some((r) => pathname.startsWith(r));

  if (isProtected && !req.auth) {
    const signInUrl = new URL("/auth/signin", req.url);
    signInUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(signInUrl);
  }

  if (isAdmin && req.auth?.user) {
    const role = (req.auth.user as any).role;
    if (role !== "ADMIN") {
      return NextResponse.redirect(new URL("/", req.url));
    }
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    "/map/:path*",
    "/report/:path*",
    "/profile/:path*",
    "/admin/:path*",
    "/((?!_next/static|_next/image|favicon.ico|icons|api).*)",
  ],
};
