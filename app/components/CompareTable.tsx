"use client";
// 두 카드 비교표 (비교 탭). 값·순위·더 나은 쪽·증감은 lib/cardview compareCardEntries 가 만든다.
// - 더 나은 쪽 값은 굵게 + 위 화살표 아이콘(색만으로 구분하지 않는다). 턴오버·파울은 낮은 쪽이 낫다. USG% 는 표시하지 않는다.
// - showDelta: 같은 선수 두 시즌 비교에서 "증감"(두 번째 − 첫 번째) 열을 보인다.
// - 순위는 각 카드가 자기 시즌(자기 순위 집단) 안에서, 등급은 자기 시즌의 국적 집단 안에서 매긴 것 — 표 아래 안내.
// - 열이 기록·A·B(·증감) 3~4개라 390px 폭에 그대로 들어간다 → 가로 스크롤 상자를 두지 않는다 (디자인 점검 A1, 실측 확인).
import { compareCardEntries, rankShort, type SeasonCardView } from "@/lib/cardview";
import { seasonShortLabel } from "@/lib/career";
import { IconArrowUp } from "./icons";
import InfoLink from "./InfoLink";

interface Props {
  a: SeasonCardView;
  b: SeasonCardView;
  /** 열 제목 (예: "워니 25-26") */
  aLabel: string;
  bLabel: string;
  seriesA: string;
  seriesB: string;
  showDelta?: boolean;
  caption: string;
}

function Mark({ color }: { color: string }) {
  // deslop-ignore-next-line 19
  return <span aria-hidden className="mr-1 inline-block h-2.5 w-2.5 shrink-0 rounded-full align-middle" style={{ background: color }} />;
}

export default function CompareTable({ a, b, aLabel, bLabel, seriesA, seriesB, showDelta = false, caption }: Props) {
  const rows = compareCardEntries(a.entry, b.entry);
  const cell = (text: string, rank: string, win: boolean) => (
    <>
      <span className={`block leading-tight ${win ? "font-bold text-ink" : "text-ink-2"}`}>
        {win && (
          <span className="mr-0.5 inline-flex align-[-3px]">
            <IconArrowUp size={16} />
            <span className="sr-only">더 나음</span>
          </span>
        )}
        {text}
      </span>
      {rank && <span className="block text-caption leading-tight text-ink-3">{rank}</span>}
    </>
  );
  // 라벨(aLabel·bLabel)에 이미 시즌이 있을 수도, 없을 수도 있어 시즌을 한 번 더 적는다 — 단, 라벨에 있으면 뺀다
  const groupNote = (v: SeasonCardView, label: string) => {
    const season = seasonShortLabel(v.seasonLabel);
    return `${label.includes(season) ? "" : `${season} `}순위 ${v.groupLabel ? `${v.groupLabel} ` : "리그 "}${v.qualifiedCount}명 중 · 등급 ${v.gradeLabel}`;
  };

  return (
    <section aria-label={caption}>
      <div className="surface-card rounded-container">
        <table className="tabular w-full border-separate border-spacing-0 text-body">
          <caption className="sr-only">{caption}</caption>
          <thead>
            <tr className="text-sub text-ink-3">
              <th scope="col" className="border-b border-line px-2 py-2 text-left font-medium">
                기록
              </th>
              <th scope="col" className="border-b border-line px-2 py-2 text-right font-semibold text-ink">
                {/* deslop-ignore-next-line 09 13 */}
                <Mark color={seriesA} />
                {aLabel}
              </th>
              <th scope="col" className="border-b border-line px-2 py-2 text-right font-semibold text-ink">
                {/* deslop-ignore-next-line 09 13 */}
                <Mark color={seriesB} />
                {bLabel}
              </th>
              {showDelta && (
                <th scope="col" className="border-b border-line px-2 py-2 text-right font-medium">
                  증감
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.key} className={r.key === "overall" ? "bg-surface-2" : ""}>
                <th scope="row" className="border-b border-line px-2 py-1.5 text-left font-medium text-ink-2">
                  {r.label}
                  {r.key === "usgPct" && <InfoLink term="usgPct" compact className="-my-3 ml-0.5" />}
                  {r.lowerIsBetter && <span className="ml-1 text-caption font-normal text-ink-3">적을수록 좋음</span>}
                  {r.key === "fouls" && <span className="block text-caption font-normal text-ink-3">순위 없음</span>}
                  {r.key === "usgPct" && <span className="block text-caption font-normal text-ink-3">공격 점유율 · 우열 없음</span>}
                </th>
                <td className="whitespace-nowrap border-b border-line px-2 py-1.5 text-right">{cell(r.aText, rankShort(r.aRank), r.better === "a")}</td>
                <td className="whitespace-nowrap border-b border-line px-2 py-1.5 text-right">{cell(r.bText, rankShort(r.bRank), r.better === "b")}</td>
                {showDelta && (
                  <td className="whitespace-nowrap border-b border-line px-2 py-1.5 text-right text-ink-2">{r.deltaText}</td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-sub leading-relaxed text-ink-3">
        <IconArrowUp size={16} className="inline align-[-3px]" /> 더 나은 쪽(턴오버·파울은 적은 쪽). 순위·등급은 각자 자기 시즌 안에서 매겼습니다: {aLabel} {groupNote(a, aLabel)} / {bLabel}{" "}
        {groupNote(b, bLabel)}. 시즌이 다르면 값보다 순위·등급을 보세요. USG%가 없는 시즌은 –.{showDelta && " 증감 = 두 번째 시즌 − 첫 번째 시즌(성공률은 %p)."}
      </p>
    </section>
  );
}
