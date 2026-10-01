// 선수 상세 "비슷한 시즌" (Basketball-Reference Similarity Scores 참고, 2026-10-01).
// 고른 시즌 카드의 레이더 6축과 가장 가까운 다른 선수의 시즌 5개 — 계산은 빌드 때 lib/similar(→ lib/data loadSimilarPlayers).
// 같은 국적 풀·같은 포지션 묶음끼리만, 각자 시즌 안 백분위라 시대가 달라도 "그 시즌에서의 역할"이 비슷한 선수가 나온다.
import Link from "next/link";
import { seasonShortLabel } from "@/lib/career";
import { playerHref } from "@/lib/cardview";
import { teamShortLabel } from "@/lib/images";
import type { SimilarEntry } from "@/lib/similar";
import InfoLink from "./InfoLink";
import PlayerAvatar from "./PlayerAvatar";

export default function SimilarPlayers({ items, seasonShort }: { items: SimilarEntry[] | undefined; seasonShort: string }) {
  return (
    <section aria-labelledby="similar-title">
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="similar-title" className="flex items-center gap-1 text-h2 font-bold">
          비슷한 시즌 <InfoLink term="similar" className="ml-1" />
        </h2>
        <span className="text-sub text-ink-3">{seasonShort} 레이더 6축과 가까운 다른 선수</span>
      </div>
      {!items || items.length === 0 ? (
        <p className="surface-card rounded-container px-4 py-5 text-sub text-ink-2">이 시즌은 표본 기준(10경기·100분)에 못 미쳐 비교하지 않습니다.</p>
      ) : (
        <ol className="tabular grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
          {items.map((m, i) => (
            <li key={`${m.id}-${m.seasonCode}`}>
              <Link
                href={playerHref(m.id, m.seasonCode)}
                className="focus-ring surface-card flex min-h-12 items-center gap-2.5 rounded-card px-3 py-2.5 transition-colors duration-200 hover:bg-surface-2 lg:flex-col lg:items-start"
              >
                <span className="w-4 shrink-0 text-center text-sub font-semibold text-ink-3 lg:hidden">{i + 1}</span>
                <PlayerAvatar photoUrl={m.photoUrl} nameKo={m.nameKo} color={{ primary: m.teamColor, secondary: m.teamColor, text: "#ffffff" }} size={36} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-body font-semibold leading-tight text-ink">{m.nameKo}</span>
                  <span className="block truncate text-sub text-ink-3">
                    {seasonShortLabel(m.seasonLabel)} · {teamShortLabel(m.teamShort)}
                  </span>
                </span>
                <span className="shrink-0 text-right lg:text-left">
                  <span className="block text-body font-bold leading-tight text-ink">{m.score.toFixed(1)}</span>
                  <span className="block text-caption text-ink-3">유사도</span>
                </span>
              </Link>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
