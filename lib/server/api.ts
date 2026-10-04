// 회원 API 공통 (서버 전용): 다른 사이트에서 보낸 쓰기 요청 막기 + JSON 응답
import "server-only";
import { NextResponse } from "next/server";
import site from "@/data/codes/site.json";

export function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

/** 쓰기 요청(PATCH·PUT·DELETE)은 우리 사이트에서 보낸 JSON 만 받는다 */
export function badWriteRequest(req: Request): NextResponse | null {
  const origin = req.headers.get("origin");
  const allowed = new Set([new URL(site.siteUrl).origin, new URL(req.url).origin]);
  if (origin && !allowed.has(origin)) return json({ error: "forbidden" }, 403);
  if (req.method !== "DELETE" && !(req.headers.get("content-type") ?? "").includes("application/json")) return json({ error: "bad_request" }, 400);
  return null;
}

/** 본문 JSON (크기 10KB 까지) */
export async function readJson(req: Request): Promise<unknown> {
  const text = await req.text();
  if (text.length > 10_000) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}
