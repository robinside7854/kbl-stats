// 시즌 어워즈 (2026-10-02 사용자 요청): 마감된 시즌 리더보드 맨 위에 그 시즌 개인 수상 전부.
// 순서: 챔피언·정규리그 1위 → 주요 시상(MVP·외국선수 MVP·챔프전 MVP·신인상, 큰 카드) → 베스트5·수비 5걸(5명 줄)
//      → 정규리그 시상(사진 줄) → 라운드/월간 MVP(작은 목록). 데이터·순서는 lib/awards buildSeasonAwardsView.
// 기록 부문·올스타전은 2026-10-02 사용자 요청으로 뺐다.
// 공홈 역대수상현황 표 그대로라 시상 이름은 그 시즌 표기와 조금 다를 수 있다(2025-26 국내선수 MVP = 정규리그 MVP 줄).
import Link from "next/link";
import type { AwardItemView, AwardWinnerView, SeasonAwardsView } from "@/lib/awards";
import { FALLBACK_TEAM_COLOR } from "@/lib/teams";
import PlayerAvatar from "./PlayerAvatar";
import { PlayerLink, TeamLink } from "./EntityLinks";
import { IconTrophy } from "./icons";

const GOLD = { background: "var(--grade-s)", color: "var(--grade-s-ink)" };

/** 이름 + 팀 — 이름은 선수 상세 그 시즌, 팀은 팀 페이지 그 시즌 (2026-10-14: 따로 누른다) */
function WinnerName({ w, season, className = "", stacked = false }: { w: AwardWinnerView; season: number; className?: string; stacked?: boolean }) {
  const name = w.href ? (
    <Link href={w.href} className="focus-ring rounded-md font-bold text-ink underline-offset-2 hover:underline">
      {w.name}
    </Link>
  ) : (
    <span className="font-bold text-ink">{w.name}</span>
  );
  const team = (
    <TeamLink code={w.team?.teamCode} season={season} place="awards" className="text-ink-3">
      {w.teamLabel}
    </TeamLink>
  );
  // stacked: 이름 아래 줄에 팀 — 좁은 카드에서 "아셈 마레이 LG" 가 이름 중간에서 꺾이지 않게
  return stacked ? (
    <span className={className}>
      <span className="block">{name}</span>
      <span className="block text-sub text-ink-3 lg:text-body">
        {team}
        {w.note && <> · {w.note}</>}
      </span>
    </span>
  ) : (
    <span className={className}>
      {name} {team}
      {w.note && <span className="text-ink-3"> · {w.note}</span>}
    </span>
  );
}

/** 주요 시상 카드: 상 이름 띠 + 사진 + 이름·팀. 공동 수상은 아래로 쌓는다 */
function MajorCard({ item, season }: { item: AwardItemView; season: number }) {
  const gold = item.key === "mvp" || item.key === "finalsMvp";
  return (
    <li className="surface-card flex min-w-0 flex-col rounded-card p-3 lg:p-4">
      <span
        className="inline-flex w-fit items-center gap-1 rounded-control px-2 py-0.5 text-caption font-bold lg:text-sub"
        style={gold ? GOLD : { background: "var(--surface-2)", color: "var(--ink-2)" }}
      >
        <IconTrophy size={16} aria-hidden />
        {item.label}
      </span>
      {item.winners.map((w, i) => (
        <div key={`${w.name}-${i}`} className="mt-2.5 flex min-w-0 items-center gap-2.5 lg:mt-3 lg:gap-4">
          {/* PC 는 사진·이름을 크게 (2026-10-06 사용자: 넓은 카드에 작은 글씨만 있다) */}
          {/* deslop-ignore-next-line 19 */}
          <PlayerLink id={w.playerNo} season={season} tabIndex={-1} aria-label={`${w.name} 선수 페이지`} className="shrink-0 rounded-full">
            <span className="lg:hidden">
              <PlayerAvatar photoUrl={w.photoUrl} nameKo={w.name} color={w.team?.color ?? FALLBACK_TEAM_COLOR} size={52} />
            </span>
            <span className="hidden lg:inline">
              <PlayerAvatar photoUrl={w.photoUrl} nameKo={w.name} color={w.team?.color ?? FALLBACK_TEAM_COLOR} size={76} />
            </span>
          </PlayerLink>
          <WinnerName w={w} season={season} stacked className="min-w-0 text-body break-keep lg:text-h2" />
        </div>
      ))}
    </li>
  );
}

/** 사진 줄 카드: 베스트5·수비 5걸(한 상의 5명) / 정규리그 시상(상마다 한 칸, 위에 상 이름) */
function PhotoRow({ title, cells, season }: { title: string; cells: { caption: string | null; w: AwardWinnerView }[]; season: number }) {
  return (
    <div className="surface-card rounded-card p-3 lg:p-4">
      <p className="text-sub font-bold text-ink lg:text-body">{title}</p>
      {/* 상 이름이 위에 붙는 줄(정규리그 시상)은 폰에서 3칸 — 5칸이면 "페어플레이상" 이 칸을 넘친다 */}
      <ul className={`mt-2 grid gap-x-1.5 gap-y-3 ${cells.some((c) => c.caption) ? "grid-cols-3 sm:grid-cols-5" : "grid-cols-5"}`}>
        {cells.map(({ caption, w }, i) => {
          const inner = (
            <>
              {caption && <span className="mb-1 flex h-8 w-full items-end justify-center break-keep text-caption font-semibold leading-tight text-ink-2 lg:text-sub">{caption}</span>}
              <span className="lg:hidden">
                <PlayerAvatar photoUrl={w.photoUrl} nameKo={w.name} color={w.team?.color ?? FALLBACK_TEAM_COLOR} size={44} />
              </span>
              <span className="hidden lg:inline">
                <PlayerAvatar photoUrl={w.photoUrl} nameKo={w.name} color={w.team?.color ?? FALLBACK_TEAM_COLOR} size={80} />
              </span>
              <span className="mt-1 w-full truncate text-caption font-semibold text-ink lg:mt-2 lg:text-body">{w.name}</span>
            </>
          );
          return (
            <li key={`${w.name}-${i}`} className="flex min-w-0 flex-col items-center text-center">
              {w.href ? (
                <Link href={w.href} className="focus-ring flex min-h-10 w-full flex-col items-center rounded-md transition-colors duration-200 hover:bg-surface-2">
                  {inner}
                </Link>
              ) : (
                <span className="flex w-full flex-col items-center">{inner}</span>
              )}
              <TeamLink code={w.team?.teamCode} season={season} place="awards" className="max-w-full truncate text-caption text-ink-3 lg:text-sub">
                {w.teamLabel}
              </TeamLink>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** 작은 목록 묶음: "상 이름 — 수상자" 줄 */
function ListGroup({ label, items, season }: { label: string; items: AwardItemView[]; season: number }) {
  return (
    <div className="surface-card rounded-card p-3">
      <p className="text-sub font-bold text-ink">{label}</p>
      <dl className="mt-1.5 divide-y divide-line">
        {items.map((it) => (
          <div key={it.key} className="grid grid-cols-[6.5rem_minmax(0,1fr)] items-baseline gap-2 py-1.5 text-sub">
            <dt className="text-ink-2">{it.label}</dt>
            <dd className="min-w-0 space-y-0.5">
              {it.winners.map((w, i) => (
                <WinnerName key={`${w.name}-${i}`} w={w} season={season} className="block [overflow-wrap:anywhere]" />
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
              <p className="mt-0.5 text-h2 font-black">
                <TeamLink code={view.teamCodes[view.finals.champion]} season={view.seasonCode} place="awards">
                  {view.finals.champion}
                </TeamLink>
              </p>
              <p className="text-sub">
                {view.finals.championRecord} · 준우승{" "}
                <TeamLink code={view.teamCodes[view.finals.runnerUp]} season={view.seasonCode} place="awards">
                  {view.finals.runnerUp}
                </TeamLink>
              </p>
            </div>
          )}
          {view.regular && (
            <div className="surface-card rounded-card p-3">
              <p className="text-caption font-bold text-ink-2">정규리그 1위</p>
              <p className="mt-0.5 text-h2 font-black text-ink">
                <TeamLink code={view.teamCodes[view.regular.first]} season={view.seasonCode} place="awards">
                  {view.regular.first}
                </TeamLink>
              </p>
              <p className="text-sub text-ink-2">
                {view.regular.firstRecord} · 2위{" "}
                <TeamLink code={view.teamCodes[view.regular.second]} season={view.seasonCode} place="awards">
                  {view.regular.second}
                </TeamLink>
              </p>
            </div>
          )}
        </div>
      )}

      {major && (
        <ul className="mt-3 grid grid-cols-2 gap-2 lg:grid-cols-4">
          {major.items.map((it) => (
            <MajorCard key={it.key} item={it} season={view.seasonCode} />
          ))}
        </ul>
      )}

      {/* 베스트5 → 바로 아래 수비 5걸 → 정규리그 시상 (모두 사진 줄) */}
      {(team5 || regular) && (
        <div className="mt-3 grid gap-2">
          {team5?.items.map((it) => (
            <PhotoRow key={it.key} title={it.label} season={view.seasonCode} cells={it.winners.map((w) => ({ caption: null, w }))} />
          ))}
          {/* 수비 5걸이 공식 표에 "-" 뿐인 시즌(23-24 ~)은 자리를 비우지 않고 안내 한 줄 */}
          {team5?.items.some((it) => it.key === "best5") && !team5.items.some((it) => it.key === "defense5") && (
            <div className="surface-card rounded-card p-3">
              <p className="text-sub font-bold text-ink">수비 5걸</p>
              <p className="mt-1 text-sub text-ink-3">KBL 공식 기록에 이 시즌 수상자가 없습니다</p>
            </div>
          )}
          {regular && (
            <PhotoRow
              title={regular.label}
              season={view.seasonCode}
              cells={regular.items.flatMap((it) => it.winners.map((w) => ({ caption: it.label, w })))}
            />
          )}
        </div>
      )}

      {rest.length > 0 && (
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {rest.map((g) => (
            <ListGroup key={g.group} label={g.label} items={g.items} season={view.seasonCode} />
          ))}
        </div>
      )}
    </section>
  );
}
