import { NextResponse } from "next/server";
import { clearSessionCookie } from "@/server/auth/session";
import { successResponse } from "@/server/utils/response";

export async function POST() {
  const response = successResponse({ success: true, message: "Logged out successfully" });
  clearSessionCookie(response);
  return response;
}
