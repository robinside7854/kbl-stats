// 용어 탭 (/glossary): lib/glossary.ts 14개 항목을 표로 — 이름 · 한 줄 설명 · 계산식(고정폭) · 비고(검산 여부·KBL 특이사항) · 출처.
// 카드 등급 영역·순위표 열 머리글의 ⓘ 가 여기 앵커(/glossary#ts 등, GLOSSARY_ANCHORS)로 연결된다 — 앵커 줄은 강조된다.
// 모바일(768px 미만)은 표의 한 줄을 카드처럼 세로로 쌓는다 (같은 표 마크업, CSS만 다름 — 가로 스크롤 없음).
import type { Metadata } from "next";
import { listSeasonsWithPlayers, loadSeasonData } from "@/lib/data";
import { GLOSSARY, GLOSSARY_ANCHORS } from "@/lib/glossary";
import { IconExternal } from "@/app/components/icons";
import SiteNav from "@/app/components/SiteNav";
import SourceFooter from "@/app/components/SourceFooter";

export const metadata: Metadata = {
  title: "용어 풀이 · KBL 팬 스탯",
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
              className="focus-ring inline-flex h-10 items-center rounded-lg border border-line bg-surface px-3 text-sub font-semibold text-ink-2 transition-colors duration-200 hover:bg-surface-2 hover:text-ink"
            >
              {g.name}
            </a>
          ))}
        </nav>

        <div className="surface-card rounded-2xl max-md:border-0 max-md:bg-transparent max-md:shadow-none">
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
                  className="scroll-mt-4 target:bg-surface-2 max-md:block max-md:rounded-2xl max-md:border max-md:border-line max-md:bg-surface max-md:shadow-card max-md:p-3 max-md:target:bg-surface-2 max-md:target:ring-2 max-md:target:ring-ink"
                >
                  <th scope="row" className={`${CELL} text-left text-base font-bold text-ink`}>
                    {g.name}
                  </th>
                  <td className={`${CELL} text-ink`}>{g.short}</td>
                  <td className={CELL}>
                    <code className="block rounded-lg bg-surface-2 px-2.5 py-2 text-sub leading-relaxed text-ink-2 [overflow-wrap:anywhere]">
                      {g.formula}
                    </code>
                  </td>
                  <td className={`${CELL} text-sub leading-relaxed text-ink-2`}>
                    <span className="font-semibold text-ink-3 md:hidden">비고 · </span>
                    {g.note}
                  </td>
                  <td className={`${CELL} text-sub`}>
                    {g.source ? (
                      <a
                        href={g.source}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="focus-ring rounded-lg font-semibold text-ink-2 underline underline-offset-4 transition-colors duration-200 hover:text-ink"
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
      </main>
      <SourceFooter fetchedAt={seasons[0] ? loadSeasonData(latest)?.fetchedAt : undefined} wide />
    </>
  );
}
