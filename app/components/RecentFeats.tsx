"use client";
// 홈 "새로 나온 기록" (2026-10-11 사용자 결정 A — 즐겨찾기·응원팀과 상관없이 모두에게).
// 최근 7일 경기에서 나온 커리어 하이·이번 시즌 리그 최다 갱신·통산 득점/출전 이정표를 선수-경기 한 칸으로 (규칙은 알림함과 같은 lib/notifications, 재료는 lib/data loadRecentFeats).
// 처음엔 FEATS_VISIBLE 칸만, "더 보기"로 전부. 마지막 경기일이 아닌 칸은 날짜를 붙인다.
// 2026-10-16: 기록마다 맥락 꼬리표 한두 줄(lib/feat-context — 올 시즌 리그 몇 번째·역대 몇 명뿐·이정표 역대 몇 번째).
// GA4: home_feat_click(kind = 가장 높은 단계 career·careerTie·league·milestone, player_no) · filter_change screen=home filter=feats value=more
import Link from "next/link";
import { useState } from "react";
import { FEAT_LEVEL_LABEL, type FeatLevel, type RecentFeat } from "@/lib/notifications";
import { gameDayLabel } from "@/lib/games";
import { teamShortLabel } from "@/lib/images";
import { IconChevronDown } from "./icons";
import PlayerAvatar from "./PlayerAvatar";
import { trackEvent, trackFilters } from "./track";

/** 처음 보이는 칸 수 */
export const FEATS_VISIBLE = 6;

/** 단계 이름은 꼬리표 상자 없이 색 글자로만 (2026-10-16 디자인 정리 M2) — 커리어 하이 금색, 나머지 회색 */
function LevelTag({ level }: { level: FeatLevel }) {
  const gold = level === "career" || level === "careerTie";
  return (
    <span className={`shrink-0 text-caption font-bold ${gold ? "text-[var(--gold-ink)]" : "text-ink-3"}`}>{FEAT_LEVEL_LABEL[level]}</span>
  );
}

export default function RecentFeats({ feats, latestDate }: { feats: RecentFeat[]; latestDate: string }) {
  const [open, setOpen] = useState(false);
  if (feats.length === 0) return null;
  const shown = open ? feats : feats.slice(0, FEATS_VISIBLE);
  const rest = feats.length - FEATS_VISIBLE;

  return (
    <section aria-labelledby="feats-title" className="mx-auto mt-8 max-w-page px-4">
      <div className="flex items-baseline justify-between gap-2">
        <h2 id="feats-title" className="text-h2 font-bold">
          새로 나온 기록
        </h2>
        <p className="text-sub text-ink-3">최근 7일 경기</p>
      </div>
      {/* 한 상자 안 줄 나눔 (2026-10-16 디자인 정리 M2: 기록마다 카드였던 것). 칸 사이 선 = 칸마다 1px 바깥 테두리(ring) — 상자 가장자리는 overflow 로 잘린다 */}
      <ul className="surface-card mt-3 grid overflow-hidden rounded-container md:grid-cols-2 xl:grid-cols-3">
        {shown.map((f) => (
          <li key={f.key} className="min-w-0 ring-1 ring-line">
            <Link
              href={f.href}
              onClick={() => trackEvent("home_feat_click", { kind: f.lines[0].level, player_no: f.player })}
              className="focus-ring-inset flex h-full min-w-0 items-start gap-3 px-3 py-3.5 transition-colors duration-200 hover:bg-surface-2 sm:px-4"
            >
              <PlayerAvatar photoUrl={f.photoUrl} nameKo={f.name} color={f.color} size={40} />
              <span className="min-w-0 flex-1">
                <span className="tabular flex min-w-0 items-baseline gap-1 text-caption text-ink-2">
                  <span className="truncate font-semibold text-ink">{f.name}</span>
                  <span className="shrink-0">· {teamShortLabel(f.teamShort)}</span>
                  {f.date !== latestDate && <span className="shrink-0">· {gameDayLabel(f.date)}</span>}
                </span>
                <span className="mt-1 flex flex-col gap-1.5">
                  {f.lines.map((l, i) => (
                    <span key={i} className="flex min-w-0 flex-col">
                      <span className="flex min-w-0 items-baseline gap-1.5">
                        <span className={`tabular truncate font-bold text-ink ${i === 0 ? "text-body" : "text-sub"}`}>{l.text}</span>
                        <LevelTag level={l.level} />
                      </span>
                      {/* 맥락 한 줄 (2026-10-16, lib/feat-context) — 여러 개면 · 로 이어 붙인다 */}
                      {l.context && l.context.length > 0 && (
                        <span className="tabular mt-0.5 block text-caption text-ink-2 break-keep">{l.context.join(" · ")}</span>
                      )}
                    </span>
                  ))}
                </span>
                <span className="tabular mt-1.5 block truncate text-caption text-ink-3">
                  {f.game} {f.won ? "승" : "패"} · {f.stat}
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
      {rest > 0 && (
        <button
          type="button"
          aria-expanded={open}
          onClick={() => {
            setOpen((v) => !v);
            if (!open) trackFilters("home", { feats: "more" });
          }}
          className="focus-ring mt-2 flex h-11 w-full cursor-pointer items-center justify-center gap-1 rounded-control border border-line text-sub font-semibold text-ink-2 transition-colors duration-200 hover:bg-surface-2"
        >
          {open ? "접기" : `${rest}개 더 보기`}
          <IconChevronDown size={16} className={open ? "rotate-180" : ""} />
        </button>
      )}
    </section>
  );
}
