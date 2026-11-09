"use client";
// 54-0 배지 모음 (2026-11-09) — 54-0 화면(시작·결과 아래, 접어 둠)과 내 계정 화면(펼침)에서 같이 쓴다.
// 받은 배지는 금색, 아직인 배지는 점선 테두리 + 조건. 데이터는 game-badges-client(이 브라우저 + 계정).
import { useState } from "react";
import { BADGE_GROUP_LABELS, GAME_BADGES, badgeDef, earnedCount, type BadgeGroup, type BadgeKey } from "@/lib/game-badges";
import { IconBolt, IconChevronDown, IconChevronUp, IconCrown, IconMedal, IconStar, IconTeam, IconTrophy, type IconSize } from "./icons";
import { useGameBadges } from "./game-badges-client";
import { trackFilters } from "./track";
import { useThemeColors } from "./useThemeColors";

const GROUP_ORDER: BadgeGroup[] = ["record", "combo", "chem", "steady"];

function BadgeIcon({ badge, size = 20 }: { badge: BadgeKey; size?: IconSize }) {
  if (badge === "perfect" || badge === "flawless") return <IconStar size={size} />;
  if (badge === "weekly_champ") return <IconCrown size={size} />;
  const group = badgeDef(badge).group;
  if (group === "record") return <IconTrophy size={size} />;
  if (group === "combo") return <IconTeam size={size} />;
  if (group === "chem") return <IconBolt size={size} />;
  return <IconMedal size={size} />;
}

const dateLabel = (iso: string) => {
  const d = new Date(iso);
  return `${d.getFullYear()}.${d.getMonth() + 1}.${d.getDate()}`;
};

export default function GameBadgeShelf({ screen, defaultOpen = false }: { screen: "game" | "me"; defaultOpen?: boolean }) {
  const state = useGameBadges();
  const colors = useThemeColors();
  const [open, setOpen] = useState(defaultOpen);
  if (!state) return null;
  const n = earnedCount(state);
  return (
    <section id="game-badges" aria-label="54-0 배지" className="surface-card mt-4 rounded-container">
      <button
        type="button"
        aria-expanded={open}
        aria-controls="game-badge-list"
        onClick={() => {
          setOpen(!open);
          trackFilters(screen, { badges: open ? "close" : "open" });
        }}
        className="focus-ring-inset flex h-12 w-full cursor-pointer items-center justify-between gap-3 rounded-container px-4 text-left transition-colors duration-200 hover:bg-surface-2"
      >
        <span className="text-body font-bold text-ink">
          54-0 배지 <span className="tabular font-semibold text-ink-2">{n}/{GAME_BADGES.length}</span>
        </span>
        <span className="flex items-center gap-2 text-sub text-ink-2">
          <span className="tabular">{state.plays.toLocaleString("ko-KR")}판</span>
          {open ? <IconChevronUp size={20} /> : <IconChevronDown size={20} />}
        </span>
      </button>
      {open && (
        <div id="game-badge-list" className="space-y-4 border-t border-line px-4 pt-3 pb-4">
          {GROUP_ORDER.map((g) => (
            <div key={g}>
              <h3 className="text-sub font-bold text-ink">{BADGE_GROUP_LABELS[g]}</h3>
              <ul className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {GAME_BADGES.filter((b) => b.group === g).map((b) => {
                  const at = state.earned[b.key];
                  return (
                    <li
                      key={b.key}
                      className={`flex items-start gap-3 rounded-card px-3 py-2.5 ${at ? "" : "border border-dashed border-line"}`}
                      style={at ? { background: colors.gradeS, color: colors.gradeSInk } : undefined}
                    >
                      <span className={`mt-0.5 shrink-0 ${at ? "" : "text-ink-3"}`}>
                        <BadgeIcon badge={b.key} />
                      </span>
                      <span className="min-w-0">
                        <span className={`block text-sub font-bold ${at ? "" : "text-ink-2"}`}>{b.label}</span>
                        <span className={`block text-caption ${at ? "" : "text-ink-3"}`}>{b.rule}</span>
                        {at && <span className="tabular block text-caption font-semibold">{dateLabel(at)} 받음</span>}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
          <p className="text-caption text-ink-3">배지는 이 브라우저에 쌓이고, 로그인하면 계정에도 저장돼요.</p>
        </div>
      )}
    </section>
  );
}

/** 결과 화면: 이번 판에 새로 받은 배지 */
export function NewBadgesNotice({ keys }: { keys: readonly BadgeKey[] }) {
  const colors = useThemeColors();
  if (keys.length === 0) return null;
  return (
    <div role="status" className="surface-card mt-3 rounded-container px-4 py-3">
      <p className="text-body font-bold text-ink">새 배지를 받았어요</p>
      <ul className="mt-2 flex flex-wrap gap-2">
        {keys.map((k) => (
          <li
            key={k}
            className="inline-flex h-10 items-center gap-1.5 rounded-control px-3 text-sub font-bold"
            style={{ background: colors.gradeS, color: colors.gradeSInk }}
          >
            <BadgeIcon badge={k} size={16} />
            {badgeDef(k).label}
          </li>
        ))}
      </ul>
    </div>
  );
}
