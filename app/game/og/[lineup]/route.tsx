// 54-0 결과 미리보기 그림 (2026-10-27): 1200×630 PNG — 카톡·X 링크 카드에 "48승 6패 + 다섯 명"이 보이게.
// 성적은 서버가 라인업으로 다시 계산(lib/server/game-result). 선수 사진·팀 로고는 넣지 않는다(scripts/build-og.tsx 와 같은 원칙).
// 글꼴은 레포의 assets/fonts/Pretendard(OFL) — 배포 함수에 같이 실리게 next.config outputFileTracingIncludes.
// 라인업마다 처음 한 번 그리고 하루 동안 저장해 둔다.
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { GAME_SEASON_GAMES, GAME_SLOTS, resultVerdict, SLOT_LABELS } from "@/lib/game";
import { teamShortLabel } from "@/lib/images";
import { OG_HEIGHT, OG_WIDTH, SITE_URL } from "@/lib/share";
import { loadSharedGameResult } from "@/lib/server/game-result";

export const revalidate = 86400;
export const dynamicParams = true;
export function generateStaticParams() {
  return [];
}

const INK = "#111110";
const GOLD = "#E8C468";
const DOMAIN = SITE_URL.replace(/^https?:\/\//, "");

let fontsP: Promise<[Buffer, Buffer]> | null = null;
function fonts() {
  fontsP ??= Promise.all([
    readFile(join(process.cwd(), "assets", "fonts", "Pretendard-Bold.otf")),
    readFile(join(process.cwd(), "assets", "fonts", "Pretendard-Regular.otf")),
  ]);
  return fontsP;
}

export async function GET(_req: Request, { params }: { params: Promise<{ lineup: string }> }) {
  const { lineup } = await params;
  const shared = await loadSharedGameResult(lineup);
  if (!shared) return new Response("not found", { status: 404 });
  const { result, players } = shared;
  const perfect = result.wins === GAME_SEASON_GAMES;
  const [bold, regular] = await fonts();
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", background: INK, color: "#fff", fontFamily: "Pretendard", padding: "48px 56px" }}>
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", width: 470 }}>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ fontSize: 30, fontWeight: 700, opacity: 0.7 }}>54-0 · KBL 역대 라인업</div>
            <div style={{ display: "flex", fontSize: 168, fontWeight: 700, letterSpacing: -6, lineHeight: 1, color: GOLD, marginTop: 18 }}>
              {`${result.wins}-${result.losses}`}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 14, marginTop: 18 }}>
              {perfect && (
                <div style={{ display: "flex", padding: "6px 18px", borderRadius: 999, background: GOLD, color: INK, fontSize: 30, fontWeight: 700 }}>전승</div>
              )}
              <div style={{ fontSize: 36, fontWeight: 700 }}>{resultVerdict(result.wins)}</div>
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <div style={{ fontSize: 38, fontWeight: 700 }}>이 기록, 넘을 수 있어요?</div>
            <div style={{ fontSize: 24, opacity: 0.6 }}>{`${DOMAIN}/game`}</div>
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", gap: 14, flex: 1, marginLeft: 40 }}>
          {players.map((p, i) => (
            <div
              key={p.c.id}
              style={{ display: "flex", alignItems: "center", gap: 18, background: "rgba(255,255,255,0.07)", borderRadius: 16, padding: "14px 20px" }}
            >
              <div style={{ width: 10, height: 52, borderRadius: 4, background: p.team?.color.primary ?? "#888" }} />
              <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
                <div style={{ fontSize: 36, fontWeight: 700, lineHeight: 1.15 }}>{p.c.nameKo}</div>
                <div style={{ fontSize: 22, opacity: 0.65 }}>
                  {`${SLOT_LABELS[GAME_SLOTS[i]]} · ${p.team ? teamShortLabel(p.team.name) : ""} ${p.c.season}`}
                </div>
              </div>
              <div style={{ fontSize: 26, fontWeight: 700, opacity: 0.85 }}>{`${p.c.ppg.toFixed(1)}점`}</div>
            </div>
          ))}
        </div>
      </div>
    ),
    {
      width: OG_WIDTH,
      height: OG_HEIGHT,
      fonts: [
        { name: "Pretendard", data: bold, weight: 700, style: "normal" },
        { name: "Pretendard", data: regular, weight: 400, style: "normal" },
      ],
      headers: { "Cache-Control": "public, max-age=86400, s-maxage=86400" },
    },
  );
}

