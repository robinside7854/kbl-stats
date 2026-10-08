"use client";
// 역대 기록 순위 목록 한 벌 (한 경기 최다·한 시즌 최다·수상·우승 공용). 줄 = 순위 · 사진 · 이름 · 둘째 줄 · 큰 숫자.
// 부문을 바꾸면 부모가 key 를 바꿔 처음 20개부터 다시 보인다. 이름 쪽을 누르면 선수 상세, 정규시즌 한 경기 기록은 오른쪽 달력 버튼으로 그날 경기 일정(박스스코어)으로 간다.
import Link from "next/link";
import { useState } from "react";
import { recordBarShare, type RecordListItem, type RecordPerson } from "@/lib/records";
import { IconCalendar } from "./icons";
import PlayerAvatar from "./PlayerAvatar";

const PAGE = 20;

/** onReset: 필터 때문에 비었을 때만 넘긴다 → "필터 초기화" 버튼 (빈 화면엔 다음 행동, 2026-10-08) */
export default function RecordList({ items, people, empty, onReset }: { items: RecordListItem[]; people: Record<string, RecordPerson>; empty: string; onReset?: () => void }) {
  const [limit, setLimit] = useState(PAGE);
  const shown = items.slice(0, limit);
  // PC 막대 기준 = 목록 1위 값 (num 은 순위를 매기는 값, 클수록 위)
  const barMax = items.reduce((m, r) => Math.max(m, r.num), 0);
  if (items.length === 0)
    return (
      <div className="surface-card rounded-container px-4 py-8 text-center">
        <p className="text-body text-ink-2">{empty}</p>
        {onReset && <ResetButton onClick={onReset} />}
      </div>
    );
  return (
    <>
      <ol className="surface-card tabular divide-y divide-line rounded-container">
        {shown.map((r, i) => {
          const p = people[r.id];
          const name = p?.nameKo ?? r.id;
          return (
            <li key={`${r.id}-${i}`} className="flex items-stretch">
              <Link
                href={`/player/${r.id}`}
                className="focus-ring-inset flex min-h-14 min-w-0 flex-1 items-center gap-3 px-3 py-2 transition-colors duration-200 hover:bg-surface-2"
              >
                <span className={`w-7 shrink-0 text-center text-body ${r.rank <= 3 ? "font-black text-ink" : "font-semibold text-ink-3"}`}>{r.rank}</span>
                {/* 사진 자리 폭 고정: 1~3위 사진이 커도 이름·막대 시작선이 같게 */}
                <span className="flex w-10 shrink-0 justify-center">
                  <PlayerAvatar
                    photoUrl={p?.photoUrl ?? null}
                    nameKo={name}
                    color={{ primary: p?.color ?? "#6b7280", secondary: p?.color ?? "#6b7280", text: "#ffffff" }}
                    size={r.rank <= 3 ? 40 : 32}
                  />
                </span>
                <span className="min-w-0 flex-1 md:w-96 md:flex-none xl:w-[28rem]">
                  <span className="block truncate text-body font-semibold leading-tight text-ink">{name}</span>
                  <span className="block text-sub leading-snug text-ink-3">{r.sub}</span>
                </span>
                {/* PC: 1위 대비 막대 (이름과 숫자 사이 빈칸 대신) */}
                <span aria-hidden className="hidden min-w-0 flex-1 md:block">
                  <span className="block h-2.5 rounded-sm opacity-80" style={{ width: `${recordBarShare(r.num, barMax) * 100}%`, background: p?.color ?? "#6b7280" }} />
                </span>
                <span className="shrink-0 text-right md:min-w-28">
                  {/* deslop-ignore-next-line 11 */}
                  <span className="block text-lg font-bold leading-tight tracking-tight text-ink lg:text-xl">
                    {r.value}
                    <span className="ml-0.5 text-caption font-medium text-ink-3">{r.unit}</span>
                  </span>
                  {r.note && <span className="block text-caption text-ink-3">{r.note}</span>}
                </span>
              </Link>
              {r.gameHref !== undefined && (
                <span className="flex w-11 shrink-0 items-center justify-center border-l border-line">
                  {r.gameHref ? (
                    <Link
                      href={r.gameHref}
                      aria-label={`${name} 기록 경기 일정 보기`}
                      title="그날 경기 일정"
                      className="focus-ring flex h-10 w-10 items-center justify-center rounded-control text-ink-3 transition-colors duration-200 hover:bg-surface-2 hover:text-ink"
                    >
                      <IconCalendar size={20} />
                    </Link>
                  ) : null}
                </span>
              )}
            </li>
          );
        })}
      </ol>
      {items.length > shown.length && (
        <button
          type="button"
          onClick={() => setLimit((n) => n + PAGE)}
          className="focus-ring mt-3 h-11 w-full rounded-control border border-line bg-surface text-body font-semibold text-ink transition-colors duration-200 hover:bg-surface-2"
        >
          더 보기 (남은 {items.length - shown.length}명)
        </button>
      )}
    </>
  );
}

/** 결과 0명일 때 "필터 초기화" (리더보드·선수 탭과 같은 모양) */
export function ResetButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="focus-ring mt-4 h-11 rounded-control border border-line bg-surface px-4 text-body font-semibold text-ink transition-colors duration-200 hover:bg-surface-2"
    >
      필터 초기화
    </button>
  );
}
