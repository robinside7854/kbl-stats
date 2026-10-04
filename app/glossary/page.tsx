// 용어 풀이 (/glossary): lib/glossary.ts 항목을 묶음(기록 지표·등급과 라벨·슛 차트·그 밖에)별 목록으로 — 이름 · 한 문장 설명 ·
// 알아 둘 점 · 계산식(작게) · 출처(작게). 2026-10-01 "길고 지루하다" 피드백으로 표 → 읽기 쉬운 목록, 문장 대폭 축약. 하단 푸터에서 어디서든 들어온다.
// 메뉴에는 없다(2026-09-30 피드백 5차) — 각 화면 ⓘ 팝오버(HelpPopover)의 "자세히"가 여기 앵커(/glossary#ts 등, GLOSSARY_ANCHORS)로 연결된다 — 앵커 줄은 강조된다.
// 그 아래 "선수 유형 라벨"(lib/glossary PLAYER_TYPES, 앵커 #type-{키})·"슛 구역"(lib/shots SHOT_ZONES, #zone-{키})·"주 공격 유형"(OFFENSE_TYPES, #offense-{키})·"칭호 배지"(lib/badges BADGE_DEFS, 앵커 #badge-{키}) 규칙 표.
// 모바일(768px 미만)은 표의 한 줄을 카드처럼 세로로 쌓는다 (같은 표 마크업, CSS만 다름 — 가로 스크롤 없음).
import type { Metadata } from "next";
import { shareMetadata } from "@/lib/share";
import { listSeasonsWithPlayers, loadSeasonData } from "@/lib/data";
import { GLOSSARY, GLOSSARY_ANCHORS, GLOSSARY_GROUPS, OFFENSE_MIN_ATTEMPTS, OFFENSE_TYPES, PLAYER_TYPES } from "@/lib/glossary";
import { SHOT_ZONES } from "@/lib/shots";
import { BADGE_DEFS } from "@/lib/badges";
import { IconExternal } from "@/app/components/icons";
import SiteNav from "@/app/components/SiteNav";
import SourceFooter from "@/app/components/SourceFooter";

export const metadata: Metadata = shareMetadata({
  title: "용어 풀이 · KBL - Stats Reference",
  description: "PER·TS%·USG% 같은 지표와 등급·라벨이 무슨 뜻인지 짧게 풀었습니다. 비영리 팬 프로젝트.",
  path: "/glossary",
});

/** 출처 링크 글자: 주소의 사이트 이름 */
function sourceName(url: string): string {
  try {
    const host = new URL(url).hostname.replace(/^www\./, "");
    return host.includes("basketball-reference") ? "Basketball-Reference" : host.includes("wikipedia") ? "Wikipedia" : host;
  } catch {
    return "출처";
  }
}

/** 규칙 표 한 줄 (선수 유형 라벨·칭호 배지) */
interface RuleRow {
  id: string;
  label: string;
  condition: string;
  short: string;
}

/**
 * 규칙 목록: 이름 · 한 줄 설명 · 조건(작게). 줄마다 앵커(id)가 있어 카드 유형 라벨·히어로 배지에서 바로 그 줄로 온다.
 * 위 용어 목록과 같은 모양(구분선 목록) — 모바일에서 카드를 줄마다 쌓지 않아 짧다.
 */
function RuleTable({ id, title, intro, rows }: { id: string; title: string; intro: string; head: string; rows: RuleRow[] }) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="mt-8 scroll-mt-4">
      <h2 id={`${id}-title`} className="text-h2 font-bold">
        {title}
      </h2>
      <p className="mt-1 text-sub text-ink-2">{intro}</p>
      <ul className="surface-card mt-3 divide-y divide-line rounded-container">
        {rows.map((r) => (
          <li key={r.id} id={r.id} className="scroll-mt-4 px-4 py-3 target:bg-surface-2">
            <p className="text-body">
              <span className="font-bold text-ink">{r.label}</span>
              <span className="text-ink-2"> · {r.short}</span>
            </p>
            <p className="mt-0.5 text-caption leading-relaxed text-ink-3">{r.condition}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}

export default function GlossaryPage() {
  const seasons = listSeasonsWithPlayers();
  const latest = seasons[0]?.seasonCode ?? 0;
  return (
    <>
      <SiteNav seasons={seasons} seasonCode={latest} view="glossary" wide />
      <main className="mx-auto max-w-5xl px-4 pt-5">
        <header className="mb-2">
          <h1 className="text-h1 font-bold">용어 풀이</h1>
          <p className="mt-1 text-body text-ink-2">이 사이트에 나오는 숫자와 라벨이 무슨 뜻인지 짧게 적었습니다.</p>
        </header>

        {GLOSSARY_GROUPS.map((grp) => {
          const items = GLOSSARY.filter((g) => g.group === grp.key);
          return (
            <section key={grp.key} aria-labelledby={`g-${grp.key}`} className="mt-6">
              <h2 id={`g-${grp.key}`} className="text-h2 font-bold">
                {grp.title}
              </h2>
              <ul className="surface-card mt-3 divide-y divide-line rounded-container">
                {items.map((g) => (
                  <li key={g.key} id={GLOSSARY_ANCHORS[g.key]} className="scroll-mt-4 px-4 py-4 target:bg-surface-2">
                    <h3 className="text-body font-bold text-ink">{g.name}</h3>
                    <p className="mt-1 max-w-[42rem] text-body leading-relaxed text-ink">{g.short}</p>
                    {g.note && <p className="mt-1 max-w-[42rem] text-sub leading-relaxed text-ink-2">{g.note}</p>}
                    {(g.formula || g.source) && (
                      <p className="mt-2 max-w-[42rem] text-caption leading-relaxed text-ink-3 [overflow-wrap:anywhere]">
                        {g.formula && <>계산 · {g.formula}</>}
                        {g.source && (
                          <>
                            {g.formula && " · "}
                            <a
                              href={g.source}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="focus-ring rounded-control underline underline-offset-2 transition-colors duration-200 hover:text-ink"
                            >
                              {sourceName(g.source)}
                              <IconExternal size={16} className="ml-0.5 inline align-[-4px]" />
                              <span className="sr-only"> (새 창)</span>
                            </a>
                          </>
                        )}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          );
        })}

        <RuleTable
          id="type-list"
          title="선수 유형 라벨"
          intro="위에서부터 먼저 맞는 줄이 붙습니다."
          head="라벨"
          rows={PLAYER_TYPES.map((t) => ({ id: `type-${t.key}`, label: t.label, condition: t.condition, short: t.short }))}
        />

        <RuleTable
          id="shot-zone-list"
          title="슛 구역"
          intro="선수 페이지 슛 차트의 다섯 구역입니다."
          head="구역"
          rows={SHOT_ZONES.map((z) => ({ id: `zone-${z.key}`, label: z.label, condition: z.condition, short: z.desc }))}
        />

        <RuleTable
          id="offense-list"
          title="주 공격 유형"
          intro={`슛 ${OFFENSE_MIN_ATTEMPTS}개 이상일 때, 위에서부터 먼저 맞는 줄이 붙습니다.`}
          head="유형"
          rows={OFFENSE_TYPES.map((t) => ({ id: `offense-${t.key}`, label: t.label, condition: t.condition, short: t.short }))}
        />

        <RuleTable
          id="badge-list"
          title="칭호 배지"
          intro="정규시즌 기록으로 셉니다. 위에 있을수록 먼저 보입니다."
          head="배지"
          rows={BADGE_DEFS.map((b) => ({ id: `badge-${b.key}`, label: b.label, condition: b.condition, short: b.short }))}
        />
      </main>
      <SourceFooter fetchedAt={seasons[0] ? loadSeasonData(latest)?.fetchedAt : undefined} wide />
    </>
  );
}
