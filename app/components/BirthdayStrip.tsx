"use client";
// 홈 "오늘 생일" 줄 (2026-10-01): 오늘(한국 시간)이 생일인 현역 선수를 아바타 + 고깔모자 + 케이크로 보여 주고 선수 카드로 보낸다.
// 날짜는 브라우저에서 정한다(lib/home kstDateString) — 정적 HTML 은 하루 한 번 빌드되므로. 그래서 첫 화면(서버 HTML)엔 없고,
// 브라우저에서 계산한 뒤 생일인 선수가 있을 때만 나타난다. 없으면 아무것도 그리지 않는다.
import { useEffect, useState } from "react";
import Link from "next/link";
import { birthdaysOn, kstDateString } from "@/lib/home";
import { playerHref } from "@/lib/cardview";
import { teamShortLabel } from "@/lib/images";
import type { TeamColor } from "@/lib/types";
import { IconCake, IconChevronRight, PartyHat } from "./icons";
import PlayerAvatar from "./PlayerAvatar";

export interface BirthdayPlayer {
  id: string;
  nameKo: string;
  birthday: string | null;
  photoUrl: string | null;
  teamName: string;
  color: TeamColor;
}

const AVATAR = 64;

export default function BirthdayStrip({ players, seasonCode }: { players: BirthdayPlayer[]; seasonCode: number }) {
  const [today, setToday] = useState<string | null>(null);
  useEffect(() => setToday(kstDateString(new Date())), []);
  if (!today) return null;
  const list = birthdaysOn(players, today);
  if (list.length === 0) return null;
  const [, m, d] = today.split("-");

  return (
    <section aria-labelledby="birthday-title" className="mx-auto mt-8 max-w-5xl px-4">
      <h2 id="birthday-title" className="flex items-center gap-1.5 text-h2 font-bold">
        <IconCake size={20} className="text-series-1" />
        오늘 생일
        <span className="text-sub font-medium text-ink-3">
          {Number(m)}월 {Number(d)}일
        </span>
      </h2>
      <ul className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {list.map(({ player: p, age }) => (
          <li key={p.id}>
            <Link
              href={playerHref(p.id, seasonCode)}
              className="surface-card focus-ring flex min-h-[88px] items-center gap-3 rounded-container px-3 py-3 transition-colors duration-200 hover:bg-surface-2"
              aria-label={`${p.nameKo} 선수 카드 — 오늘 만 ${age}세 생일`}
            >
              <span className="relative shrink-0" style={{ width: AVATAR, height: AVATAR }}>
                <PlayerAvatar photoUrl={p.photoUrl} nameKo={p.nameKo} color={p.color} size={AVATAR} />
                {/* 고깔모자: 아바타 오른쪽 위에 비스듬히 */}
                <span className="pointer-events-none absolute -right-2 -top-6 rotate-[18deg]">
                  <PartyHat width={26} color={p.color.primary} ink="var(--ink)" />
                </span>
                {/* 케이크 배지: 오른쪽 아래 (둥근 아바타에 붙는 둥근 배지) */}
                {/* deslop-ignore-next-line 19 */}
                <span className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full border border-line bg-surface text-series-1">
                  <IconCake size={16} />
                </span>
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-body font-bold text-ink">{p.nameKo}</span>
                <span className="block truncate text-sub text-ink-3">
                  {teamShortLabel(p.teamName)} · 만 {age}세 생일
                </span>
              </span>
              <span className="flex shrink-0 items-center gap-0.5 text-sub font-semibold text-ink-2">
                선수 카드 <IconChevronRight size={16} />
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
