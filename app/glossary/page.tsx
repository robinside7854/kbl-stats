// 용어 탭 (/glossary): lib/glossary.ts 항목을 표로 — 이름 · 한 줄 설명 · 계산식(고정폭) · 비고(검산 여부·KBL 특이사항) · 출처.
// 메뉴에는 없다(2026-09-30 피드백 5차) — 각 화면 ⓘ 팝오버(HelpPopover)의 "자세히"가 여기 앵커(/glossary#ts 등, GLOSSARY_ANCHORS)로 연결된다 — 앵커 줄은 강조된다.
// 그 아래 "선수 유형 라벨"(lib/glossary PLAYER_TYPES, 앵커 #type-{키})·"슛 구역"(lib/shots SHOT_ZONES, #zone-{키})·"주 공격 유형"(OFFENSE_TYPES, #offense-{키})·"칭호 배지"(lib/badges BADGE_DEFS, 앵커 #badge-{키}) 규칙 표.
// 모바일(768px 미만)은 표의 한 줄을 카드처럼 세로로 쌓는다 (같은 표 마크업, CSS만 다름 — 가로 스크롤 없음).
import type { Metadata } from "next";
import { listSeasonsWithPlayers, loadSeasonData } from "@/lib/data";
import { GLOSSARY, GLOSSARY_ANCHORS, OFFENSE_MIN_ATTEMPTS, OFFENSE_TYPES, PLAYER_TYPES } from "@/lib/glossary";
import { SHOT_ZONES } from "@/lib/shots";
import { BADGE_DEFS } from "@/lib/badges";
import { IconExternal } from "@/app/components/icons";
import SiteNav from "@/app/components/SiteNav";
import SourceFooter from "@/app/components/SourceFooter";

export const metadata: Metadata = {
  title: "용어 풀이 · KBL - Stats Reference",
  description: "PER·TS%·USG%·AST%·REB%·백분위 등급 등 이 사이트에 나오는 지표의 뜻과 계산식, KBL 값과 맞춰 본 결과. 비영리 팬 프로젝트.",
};

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
 * 규칙 표: 이름 · 조건 · 한 줄 설명. 줄마다 앵커(id)가 있어 카드 유형 라벨·히어로 배지에서 바로 그 줄로 온다.
 * 모바일은 위 용어 표와 같은 방식으로 한 줄을 카드처럼 세로로 쌓는다.
 */
function RuleTable({ id, title, intro, head, rows }: { id: string; title: string; intro: string; head: string; rows: RuleRow[] }) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="mt-8 scroll-mt-4">
      <h2 id={`${id}-title`} className="text-h2 font-bold">
        {title}
      </h2>
      <p className="mb-3 mt-1 text-body text-ink-2">{intro}</p>
      <div className="surface-card rounded-container max-md:border-0 max-md:bg-transparent max-md:shadow-none">
        <table className="w-full border-separate border-spacing-0 text-body max-md:block">
          <caption className="sr-only">{`${title}: ${head}, 조건, 한 줄 설명`}</caption>
          <thead className="max-md:sr-only">
            <tr className="text-left text-sub text-ink-3">
              <th scope="col" className="w-48 border-b border-line px-3 py-2 font-medium">{head}</th>
              <th scope="col" className="border-b border-line px-3 py-2 font-medium">조건</th>
              <th scope="col" className="w-72 border-b border-line px-3 py-2 font-medium">한 줄 설명</th>
            </tr>
          </thead>
          <tbody className="max-md:block max-md:space-y-3">
            {rows.map((r) => (
              <tr
                key={r.id}
                id={r.id}
                className="scroll-mt-4 target:bg-surface-2 max-md:block max-md:rounded-container max-md:border max-md:border-line max-md:bg-surface max-md:shadow-card max-md:p-3 max-md:target:bg-surface-2 max-md:target:ring-2 max-md:target:ring-ink"
              >
                <th scope="row" className={`${CELL} text-left text-base font-bold text-ink`}>
                  {r.label}
                </th>
                <td className={`${CELL} text-ink`}>{r.condition}</td>
                <td className={`${CELL} text-sub leading-relaxed text-ink-2`}>{r.short}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

const CELL = "border-b border-line px-3 py-2 align-top max-md:block max-md:border-0 max-md:px-0 max-md:py-1";

export default function GlossaryPage() {
  const seasons = listSeasonsWithPlayers();
  const latest = seasons[0]?.seasonCode ?? 0;
  return (
    <>
      <SiteNav seasons={seasons} seasonCode={latest} view="glossary" wide />
      <main className="mx-auto max-w-5xl px-4 pt-5">
        <header className="mb-4">
          <h1 className="text-h1 font-bold">용어 풀이</h1>
          <p className="mt-1 text-body text-ink-2">2차 스탯은 KBL 계산값 그대로(USG%만 ×5), 백분위·등급·표본·시도 기준은 이 사이트 규칙.</p>
        </header>

        <nav aria-label="용어 목록" className="mb-4 flex flex-wrap gap-1.5">
          {GLOSSARY.map((g) => (
            <a
              key={g.key}
              href={`#${GLOSSARY_ANCHORS[g.key]}`}
              className="focus-ring inline-flex h-10 items-center rounded-control border border-line bg-surface px-3 text-sub font-semibold text-ink-2 transition-colors duration-200 hover:bg-surface-2 hover:text-ink"
            >
              {g.name}
            </a>
          ))}
        </nav>

        <div className="surface-card rounded-container max-md:border-0 max-md:bg-transparent max-md:shadow-none">
          <table className="w-full border-separate border-spacing-0 text-body max-md:block">
            <caption className="sr-only">지표 이름, 한 줄 한 줄 설명, 계산식, 비고, 출처</caption>
            <thead className="max-md:sr-only">
              <tr className="text-left text-sub text-ink-3">
                <th scope="col" className="w-32 border-b border-line px-3 py-2 font-medium">이름</th>
                <th scope="col" className="w-48 border-b border-line px-3 py-2 font-medium">한 줄 설명</th>
                <th scope="col" className="border-b border-line px-3 py-2 font-medium">계산식</th>
                <th scope="col" className="w-60 border-b border-line px-3 py-2 font-medium">비고</th>
                <th scope="col" className="w-32 border-b border-line px-3 py-2 font-medium">출처</th>
              </tr>
            </thead>
            <tbody className="max-md:block max-md:space-y-3">
              {GLOSSARY.map((g) => (
                <tr
                  key={g.key}
                  id={GLOSSARY_ANCHORS[g.key]}
                  className="scroll-mt-4 target:bg-surface-2 max-md:block max-md:rounded-container max-md:border max-md:border-line max-md:bg-surface max-md:shadow-card max-md:p-3 max-md:target:bg-surface-2 max-md:target:ring-2 max-md:target:ring-ink"
                >
                  <th scope="row" className={`${CELL} text-left text-base font-bold text-ink`}>
                    {g.name}
                  </th>
                  <td className={`${CELL} text-ink`}>{g.short}</td>
                  <td className={CELL}>
                    <code className="block rounded-control bg-surface-2 px-2.5 py-2 text-sub leading-relaxed text-ink-2 [overflow-wrap:anywhere]">
                      {g.formula}
                    </code>
                  </td>
                  <td className={`${CELL} text-sub leading-relaxed text-ink-2 [overflow-wrap:anywhere]`}>
                    <span className="font-semibold text-ink-3 md:hidden">비고 · </span>
                    {g.note}
                  </td>
                  <td className={`${CELL} text-sub`}>
                    {g.source ? (
                      <a
                        href={g.source}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="focus-ring rounded-control font-semibold text-ink-2 underline underline-offset-4 transition-colors duration-200 hover:text-ink"
                      >
                        {sourceName(g.source)}
                        <IconExternal size={16} className="ml-0.5 inline align-[-3px]" />
                        <span className="sr-only"> (새 창)</span>
                      </a>
                    ) : (
                      <span className="text-ink-3">이 사이트 규칙</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <RuleTable
          id="type-list"
          title="선수 유형 라벨"
          intro="플레이어 카드 위쪽 라벨. 레이더 6축 백분위(같은 국적 집단 안)와 포지션으로 위에서부터 먼저 맞는 규칙을 씁니다."
          head="라벨"
          rows={PLAYER_TYPES.map((t) => ({ id: `type-${t.key}`, label: t.label, condition: t.condition, short: t.short }))}
        />

        <RuleTable
          id="shot-zone-list"
          title="슛 구역"
          intro="선수 상세 슛 차트의 구역표. 공홈 슛 차트 좌표로 계산해 공식 3점 기록과 조금 다를 수 있습니다."
          head="구역"
          rows={SHOT_ZONES.map((z) => ({ id: `zone-${z.key}`, label: z.label, condition: z.condition, short: z.desc }))}
        />

        <RuleTable
          id="offense-list"
          title="주 공격 유형"
          intro={`슛 차트 제목 옆·플레이어 카드 칩. 그 시즌 정규시즌 슛 ${OFFENSE_MIN_ATTEMPTS}개 이상일 때 구역 시도 비중으로 위에서부터 먼저 맞는 규칙을 씁니다.`}
          head="유형"
          rows={OFFENSE_TYPES.map((t) => ({ id: `offense-${t.key}`, label: t.label, condition: t.condition, short: t.short }))}
        />

        <RuleTable
          id="badge-list"
          title="칭호 배지"
          intro="선수 페이지 이름 아래 칭호. 정규시즌 기록에서 바로 셀 수 있는 것만 붙이고, 표 순서가 보여 주는 우선순위입니다."
          head="배지"
          rows={BADGE_DEFS.map((b) => ({ id: `badge-${b.key}`, label: b.label, condition: b.condition, short: b.short }))}
        />
      </main>
      <SourceFooter fetchedAt={seasons[0] ? loadSeasonData(latest)?.fetchedAt : undefined} wide />
    </>
  );
}
