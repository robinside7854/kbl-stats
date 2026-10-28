// 이미지 저장용 사진·로고 중계 (2026-10-28 사용자: "이미지 저장을 누르면 선수 사진이 사라진다").
// KBL 서버는 CORS 헤더를 주지 않아 브라우저가 공식 사진을 저장 이미지(캔버스)에 그릴 수 없다.
// 저장할 때만 브라우저가 /img-proxy/{원래 경로} 로 우리 서버에 묻고, 여기서 원래 이미지를 받아 그대로 돌려준다.
// - 화면 표시는 계속 원래 주소로 핫링크(여기를 거치지 않는다). 레포에 이미지를 저장하지 않는다
// - 허용 경로는 data/codes/site.json imageProxy.allow 만 (lib/images proxySourceUrl) — 아무 주소나 대신 받아 주지 않는다
// - 이미지가 아니면(사진 없는 선수는 KBL 이 HTML 을 준다) 404 → 화면은 대체 디자인
// - Vercel 저장(CDN)에 일주일 두어 같은 사진은 KBL 에 다시 묻지 않는다
import { proxySourceUrl } from "@/lib/images";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  const source = proxySourceUrl(`/${path.map(encodeURIComponent).join("/")}`);
  if (!source) return new Response("not found", { status: 404 });
  try {
    const res = await fetch(source, { signal: AbortSignal.timeout(8000), headers: { Accept: "image/*" }, cache: "no-store" });
    const type = res.headers.get("content-type") ?? "";
    if (!res.ok || !type.startsWith("image/")) return new Response("not found", { status: 404, headers: { "Cache-Control": "public, s-maxage=3600" } });
    return new Response(res.body, {
      headers: {
        "Content-Type": type,
        "Cache-Control": "public, max-age=86400, s-maxage=604800, stale-while-revalidate=86400",
        "X-Content-Type-Options": "nosniff",
        // 로고 SVG 를 우리 주소에서 직접 열어도 그 안의 스크립트가 돌지 않게
        "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; sandbox",
      },
    });
  } catch {
    return new Response("upstream error", { status: 502 });
  }
}
