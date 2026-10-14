"use client";
// 선수 페이지 "커리어 하이" — 업적 카드 격자 (2026-09-30 피드백 5차 #3: KBL 공홈 표와 같은 표 → 업적처럼).
// 카드 = 부문 7개(lib/highs HERO_HIGH_KEYS). 정규시즌 기록을 큰 숫자로, 아래 "vs 상대 · 날짜" 작은 글자, 오른쪽 위 횟수 배지.
// 플레이오프·챔프전은 탭 대신 카드 아래 보조 숫자 한 줄("PO 32 · 챔프전 28") — 세 구분을 3열로 두면 7장 × 3숫자가 되어 밀도가 과했다.
// 강조(색은 팀 색 하나): 그 시즌 리그 한 경기 최다와 같은 기록이면 카드 바탕을 팀 색으로 옅게 + "2023-24 시즌 최다" 칩,
// 배지 조건과 겹치면(득점 40·50 이상) 히어로 칭호 배지와 같은 색의 칩("40득점 클럽").
// 모바일 2열, PC(1024px 이상) 4열. 숫자는 tabular. 계산은 서버에서 lib/career careerHighAchievements — 여기서는 그리기만.
import type { HighAchievement } from "@/lib/career";
import { BADGE_DEFS } from "@/lib/badges";
import { desaturate, readableInk } from "@/lib/teams";
import { badgeStyle } from "./BadgeRow";
import InfoLink from "./InfoLink";
import { TeamLink } from "./EntityLinks";

const BADGE_LABEL = new Map(BADGE_DEFS.map((d) => [d.key, d.label]));

interface Props {
  items: HighAchievement[];
  /** 강조 색 (가장 최근 시즌 팀 색) */
  teamPrimary: string;
}

export default function CareerHighs({ items, teamPrimary }: Props) {
  if (items.length === 0) return null;
  const tint = desaturate(teamPrimary, 0.2);
  const hasPost = items.some((a) => a.playoff || a.finals);

  return (
    <section aria-labelledby="career-highs-title">
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="career-highs-title" className="flex items-center gap-1 text-h2 font-bold">
          커리어 하이 <InfoLink term="gameHigh" className="ml-1" />
        </h2>
        <span className="text-sub text-ink-3">정규시즌 한 경기 최다{hasPost ? " · 아래 줄은 플레이오프·챔프전" : ""}</span>
      </div>
      <ul className="tabular grid grid-cols-2 gap-2 lg:grid-cols-4">
        {items.map((a) => {
          const best = a.seasonBest !== null;
          return (
            <li
              key={a.key}
              className="surface-card flex min-w-0 flex-col rounded-card px-3 py-2.5"
              style={
                best
                  ? {
                      background: `color-mix(in srgb, ${tint} var(--rank-tint), var(--surface))`,
                      borderColor: `color-mix(in srgb, ${tint} var(--rank-border), var(--surface))`,
                    }
                  : undefined
              }
            >
              <div className="flex items-start justify-between gap-2">
                <h3 className="text-sub font-semibold text-ink-2">{a.label}</h3>
                {a.times !== null && (
                  <span className="shrink-0 rounded-control border border-line px-1.5 text-caption font-semibold leading-5 text-ink-2" aria-label={`${a.times}번 달성`}>
                    {a.times}회
                  </span>
                )}
              </div>
              <p className="mt-0.5 flex flex-wrap items-baseline gap-x-1.5">
                <span className="text-h1 font-bold tracking-tight text-ink">{a.value ?? "–"}</span>
                {a.shot && <span className="text-caption font-medium text-ink-3">{a.shot}</span>}
              </p>
              <p className="mt-0.5 text-caption text-ink-3 [overflow-wrap:anywhere]">
                {a.value === null ? (
                  "정규시즌 기록 없음"
                ) : (
                  <>
                    {a.opponent && (
                      <>
                        vs{" "}
                        <TeamLink code={a.opponentCode} season={a.opponentSeason} place="career_high" className="font-medium text-ink-2">
                          {a.opponent}
                        </TeamLink>
                        {" · "}
                      </>
                    )}
                    {a.date}
                  </>
                )}
              </p>
              {(best || a.milestone) && (
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {best && (
                    <span
                      className="inline-flex h-6 items-center rounded-control px-1.5 text-caption font-bold"
                      style={{ background: tint, color: readableInk(tint, "#ffffff") }}
                    >
                      {a.seasonBest} 시즌 최다
                    </span>
                  )}
                  {a.milestone && (
                    <span className="inline-flex h-6 items-center whitespace-nowrap rounded-control border px-1.5 text-caption font-semibold" style={badgeStyle(teamPrimary)}>
                      {BADGE_LABEL.get(a.milestone)}
                    </span>
                  )}
                </div>
              )}
              {(a.playoff || a.finals) && (
                <div className="mt-auto pt-2">
                <p className="flex flex-wrap gap-x-2 border-t border-line pt-1.5 text-caption text-ink-3">
                  {a.playoff && (
                    <span>
                      PO <b className="font-semibold text-ink-2">{a.playoff}</b>
                    </span>
                  )}
                  {a.finals && (
                    <span>
                      챔프전 <b className="font-semibold text-ink-2">{a.finals}</b>
                    </span>
                  )}
                </p>
                </div>
              )}
            </li>
          );
        })}
      </ul>
      <p className="mt-2 text-sub text-ink-3">횟수는 그 기록을 낸 경기 수, 3점·자유투 옆 작은 글자는 그 경기 성공/시도·성공률.</p>
    </section>
  );
}
