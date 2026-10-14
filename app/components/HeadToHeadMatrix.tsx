// 팀 간 상대 전적 표 (2026-10-14 스포츠 앱 비교 A-1 — KBO STATS "팀간전적" 탭): 팀 화면 "표" 보기에서 순위 표 아래.
// 줄 = 그 팀, 칸 = 그 상대에게 "승-패". 순위 표와 같은 순서. 계산은 lib/games headToHeadWins(빌드 때, 경기 결과 점수).
// 팀 로고·이름을 누르면 그 팀 페이지(그 시즌). 폰 360px 에서 11칸이 들어가게 머리글·줄 머리는 로고만, PC 는 줄 머리에 팀 이름도.
import type { StandingsSeason } from "./StandingsTable";
import TeamLogo from "./TeamLogo";
import { TeamLink } from "./EntityLinks";

export default function HeadToHeadMatrix({ season }: { season: StandingsSeason }) {
  const { rows, teams, h2h } = season;
  if (!h2h || rows.length < 2) return null;
  const name = (code: string, fallback: string) => teams[code]?.shortName ?? fallback;
  return (
    <section aria-labelledby="h2h-title" className="mt-6">
      <h2 id="h2h-title" className="text-h2 font-bold">
        팀 간 상대 전적
      </h2>
      <p className="mt-1 text-sub text-ink-3">{season.seasonShort} 정규시즌 · 줄의 팀 기준 승-패</p>
      <div className="surface-card tabular mt-3 rounded-container px-1.5 py-1 sm:px-3">
        <table className="w-full table-fixed text-caption sm:text-sub">
          <colgroup>
            <col className="w-8 sm:w-28 lg:w-40" />
            {rows.map((r) => (
              <col key={r.teamCode} />
            ))}
          </colgroup>
          <thead>
            <tr className="border-b border-line">
              <th scope="col" className="py-2 text-left text-caption font-medium text-ink-3">
                <span className="sr-only">팀</span>
              </th>
              {rows.map((r) => (
                <th key={r.teamCode} scope="col" className="py-2">
                  <TeamLink code={r.teamCode} season={season.seasonCode} place="h2h_table" className="mx-auto flex h-10 w-full items-center justify-center">
                    <TeamLogo logoUrl={teams[r.teamCode]?.logoUrl ?? null} shortName={name(r.teamCode, r.name)} color={teams[r.teamCode]?.color} size={20} />
                    <span className="sr-only">{name(r.teamCode, r.name)}</span>
                  </TeamLink>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.teamCode} className="border-b border-line last:border-b-0">
                <th scope="row" className="py-2 text-left font-semibold text-ink">
                  <TeamLink code={r.teamCode} season={season.seasonCode} place="h2h_table" className="flex min-h-10 min-w-0 items-center gap-1.5">
                    <TeamLogo logoUrl={teams[r.teamCode]?.logoUrl ?? null} shortName={name(r.teamCode, r.name)} color={teams[r.teamCode]?.color} size={20} />
                    <span className="hidden truncate sm:inline">{name(r.teamCode, r.name)}</span>
                    <span className="sr-only sm:hidden">{name(r.teamCode, r.name)}</span>
                  </TeamLink>
                </th>
                {rows.map((c, j) => {
                  if (i === j) return <td key={c.teamCode} aria-hidden className="bg-surface-2" />;
                  const w = h2h[i]?.[j] ?? 0;
                  const l = h2h[j]?.[i] ?? 0;
                  return (
                    <td
                      key={c.teamCode}
                      className={`whitespace-nowrap py-2 text-center ${w + l === 0 ? "text-ink-3" : w > l ? "font-bold text-ink" : "text-ink-2"}`}
                      aria-label={`${name(r.teamCode, r.name)} 대 ${name(c.teamCode, c.name)} ${w}승 ${l}패`}
                    >
                      {w + l === 0 ? "–" : `${w}-${l}`}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-caption text-ink-3">굵은 칸은 그 상대에게 더 많이 이긴 경우예요.</p>
    </section>
  );
}
