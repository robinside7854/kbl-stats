// 시즌 어워즈 (2026-10-02 사용자 요청): 마감된 시즌 리더보드 맨 위에 그 시즌 개인 수상 전부.
// 순서: 챔피언·정규리그 1위 → 주요 시상(MVP·외국선수 MVP·챔프전 MVP·신인상, 큰 카드) → 베스트5·수비 5걸(5명 줄)
//      → 정규리그 시상(사진 줄) → 라운드/월간 MVP(작은 목록). 데이터·순서는 lib/awards buildSeasonAwardsView.
// 기록 부문·올스타전은 2026-10-02 사용자 요청으로 뺐다.
// 공홈 역대수상현황 표 그대로라 시상 이름은 그 시즌 표기와 조금 다를 수 있다(2025-26 국내선수 MVP = 정규리그 MVP 줄).
import Link from "next/link";
import type { AwardItemView, AwardWinnerView, SeasonAwardsView } from "@/lib/awards";
import { FALLBACK_TEAM_COLOR } from "@/lib/teams";
import PlayerAvatar from "./PlayerAvatar";
import { IconTrophy } from "./icons";

const GOLD = { background: "var(--grade-s)", color: "var(--grade-s-ink)" };

/** 이름 + 팀 (링크가 있으면 선수 상세 그 시즌으로) */
function WinnerName({ w, className = "" }: { w: AwardWinnerView; className?: string }) {
  const body = (
    <>
      <span className="font-bold text-ink">{w.name}</span>
      <span className="text-ink-3"> {w.teamLabel}</span>
      {w.note && <span className="text-ink-3"> · {w.note}</span>}
    </>
  );
  return w.href ? (
    <Link href={w.href} className={`focus-ring rounded-md underline-offset-2 hover:underline ${className}`}>
      {body}
    </Link>
  ) : (
    <span className={className}>{body}</span>
  );
}

/** 주요 시상 카드: 상 이름 띠 + 사진 + 이름·팀. 공동 수상은 아래로 쌓는다 */
function MajorCard({ item }: { item: AwardItemView }) {
  const gold = item.key === "mvp" || item.key === "finalsMvp";
  return (
    <li className="surface-card flex min-w-0 flex-col rounded-card p-3">
      <span
        className="inline-flex w-fit items-center gap-1 rounded-control px-2 py-0.5 text-caption font-bold"
        style={gold ? GOLD : { background: "var(--surface-2)", color: "var(--ink-2)" }}
      >
        <IconTrophy size={16} aria-hidden />
        {item.label}
      </span>
      {item.winners.map((w, i) => (
        <div key={`${w.name}-${i}`} className="mt-2.5 flex min-w-0 items-center gap-2.5">
          <PlayerAvatar photoUrl={w.photoUrl} nameKo={w.name} color={w.team?.color ?? FALLBACK_TEAM_COLOR} size={52} />
          <WinnerName w={w} className="min-w-0 text-body [overflow-wrap:anywhere]" />
        </div>
      ))}
    </li>
  );
}

/** 사진 줄 카드: 베스트5·수비 5걸(한 상의 5명) / 정규리그 시상(상마다 한 칸, 위에 상 이름) */
function PhotoRow({ title, cells }: { title: string; cells: { caption: string | null; w: AwardWinnerView }[] }) {
  return (
    <div className="surface-card rounded-card p-3">
      <p className="text-sub font-bold text-ink">{title}</p>
      <ul className="mt-2 grid grid-cols-5 gap-x-1.5 gap-y-3">
        {cells.map(({ caption, w }, i) => {
          const inner = (
            <>
              {caption && <span className="mb-1 flex h-8 w-full items-end justify-center break-keep text-caption font-semibold leading-tight text-ink-2">{caption}</span>}
              <PlayerAvatar photoUrl={w.photoUrl} nameKo={w.name} color={w.team?.color ?? FALLBACK_TEAM_COLOR} size={44} />
              <span className="mt-1 w-full truncate text-caption font-semibold text-ink">{w.name}</span>
              <span className="w-full truncate text-caption text-ink-3">{w.teamLabel}</span>
            </>
          );
          return (
            <li key={`${w.name}-${i}`} className="min-w-0">
              {w.href ? (
                <Link href={w.href} className="focus-ring flex min-h-10 flex-col items-center rounded-md text-center transition-colors duration-200 hover:bg-surface-2">
                  {inner}
                </Link>
              ) : (
                <span className="flex flex-col items-center text-center">{inner}</span>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** 작은 목록 묶음: "상 이름 — 수상자" 줄 */
function ListGroup({ label, items }: { label: string; items: AwardItemView[] }) {
  return (
    <div className="surface-card rounded-card p-3">
      <p className="text-sub font-bold text-ink">{label}</p>
      <dl className="mt-1.5 divide-y divide-line">
        {items.map((it) => (
          <div key={it.key} className="grid grid-cols-[6.5rem_minmax(0,1fr)] items-baseline gap-2 py-1.5 text-sub">
            <dt className="text-ink-2">{it.label}</dt>
            <dd className="min-w-0 space-y-0.5">
              {it.winners.map((w, i) => (
                <WinnerName key={`${w.name}-${i}`} w={w} className="block [overflow-wrap:anywhere]" />
              ))}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

export default function SeasonAwardsBoard({ view, seasonShort }: { view: SeasonAwardsView; seasonShort: string }) {
  const major = view.groups.find((g) => g.group === "major");
  const team5 = view.groups.find((g) => g.group === "team5");
  const regular = view.groups.find((g) => g.group === "regular");
  const rest = view.groups.filter((g) => g.group === "period");
  return (
    <section aria-labelledby="season-awards-title" className="mb-6">
      <h2 id="season-awards-title" className="flex items-center gap-1.5 text-h2 font-bold">
        <IconTrophy size={20} aria-hidden />
        {seasonShort} 어워즈
      </h2>
      <p className="mt-0.5 text-caption text-ink-3">KBL 공식 시상 · 이름을 누르면 그 시즌 선수 카드</p>

      {(view.finals || view.regular) && (
        <div className="tabular mt-3 grid gap-2 sm:grid-cols-2">
          {view.finals && (
            <div className="rounded-card p-3" style={GOLD}>
              <p className="text-caption font-bold">챔피언</p>
              <p className="mt-0.5 text-h2 font-black">{view.finals.champion}</p>
              <p className="text-sub">
                {view.finals.championRecord} · 준우승 {view.finals.runnerUp}
              </p>
            </div>
          )}
          {view.regular && (
            <div className="surface-card rounded-card p-3">
              <p className="text-caption font-bold text-ink-2">정규리그 1위</p>
              <p className="mt-0.5 text-h2 font-black text-ink">{view.regular.first}</p>
              <p className="text-sub text-ink-2">
                {view.regular.firstRecord} · 2위 {view.regular.second}
              </p>
            </div>
          )}
        </div>
      )}

      {major && (
        <ul className="mt-3 grid grid-cols-2 gap-2 lg:grid-cols-4">
          {major.items.map((it) => (
            <MajorCard key={it.key} item={it} />
          ))}
        </ul>
      )}

      {/* 베스트5 → 바로 아래 수비 5걸 → 정규리그 시상 (모두 사진 줄) */}
      {(team5 || regular) && (
        <div className="mt-3 grid gap-2">
          {team5?.items.map((it) => (
            <PhotoRow key={it.key} title={it.label} cells={it.winners.map((w) => ({ caption: null, w }))} />
          ))}
          {regular && (
            <PhotoRow
              title={regular.label}
              cells={regular.items.flatMap((it) => it.winners.map((w) => ({ caption: it.label, w })))}
            />
          )}
        </div>
      )}

      {rest.length > 0 && (
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {rest.map((g) => (
            <ListGroup key={g.group} label={g.label} items={g.items} />
          ))}
        </div>
      )}
    </section>
  );
}
