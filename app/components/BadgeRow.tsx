"use client";
// 칭호 배지 줄 (선수 상세 히어로 이름 아래): 우선순위 순 최대 5개(lib/badges HERO_BADGE_LIMIT), 나머지는 "+n" 으로 접는다.
// 배지 = 팀 색을 표면 색에 옅게 섞은 바탕 + 본문 글자색(ink), 아이콘 없음. 누르면 용어 탭 "칭호 배지" 표의 그 줄로.
// 보이는 칩은 28px 이지만 누르는 영역은 위아래로 늘려 40px (음수 여백으로 줄 간격은 그대로).
// 계산은 빌드 시점 lib/badges playerBadges — 여기서는 받은 목록을 그리기만 한다.
import { useState } from "react";
import Link from "next/link";
import { BADGE_DEFS, splitBadges, type BadgeKey } from "@/lib/badges";
import { badgeHref } from "@/lib/glossary";

const CONDITION = new Map(BADGE_DEFS.map((d) => [d.key, d.condition]));

export interface BadgeItem {
  key: BadgeKey;
  label: string;
}

/** 배지 한 칸 모양 (선수 탭 그리드 카드도 같은 모양을 쓴다) */
export function badgeStyle(teamPrimary: string): React.CSSProperties {
  return {
    background: `color-mix(in srgb, ${teamPrimary} 16%, var(--surface))`,
    borderColor: `color-mix(in srgb, ${teamPrimary} 40%, var(--surface))`,
    color: "var(--ink)",
  };
}

export const BADGE_CHIP = "inline-flex h-7 items-center whitespace-nowrap rounded-control border px-2 text-sub font-semibold";

export default function BadgeRow({ badges, teamPrimary }: { badges: BadgeItem[]; teamPrimary: string }) {
  const [open, setOpen] = useState(false);
  if (badges.length === 0) return null;
  const { shown, hidden } = splitBadges(badges);
  const list = open ? badges : shown;
  const style = badgeStyle(teamPrimary);
  return (
    <ul aria-label="칭호 배지" className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
      {list.map((b) => (
        <li key={b.key}>
          <Link
            href={badgeHref(b.key)}
            title={`${b.label}: ${CONDITION.get(b.key) ?? ""}`}
            aria-label={`칭호 ${b.label} — 조건 보기`}
            className="focus-ring group -my-1.5 inline-flex h-10 items-center rounded-control"
          >
            <span className={`${BADGE_CHIP} transition-colors duration-200 group-hover:underline group-hover:underline-offset-4`} style={style}>
              {b.label}
            </span>
          </Link>
        </li>
      ))}
      {hidden > 0 && (
        <li>
          <button
            type="button"
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
            className="focus-ring group -my-1.5 inline-flex h-10 cursor-pointer items-center rounded-control"
            aria-label={open ? "칭호 배지 접기" : `칭호 배지 ${hidden}개 더 보기`}
          >
            <span className={`${BADGE_CHIP} transition-colors duration-200 group-hover:underline group-hover:underline-offset-4`} style={style}>
              {open ? "접기" : `+${hidden}`}
            </span>
          </button>
        </li>
      )}
    </ul>
  );
}
