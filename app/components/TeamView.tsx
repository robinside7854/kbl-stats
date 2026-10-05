"use client";
// 팀 페이지 본문 (/team/[팀코드], 2026-10-04): 머리말(로고·이름 이력·좋아요·계보) → 통산 성적 → 시즌 고르기 + 그 시즌 로스터
// → 시즌별 성적 표 → 레전드 → 팀 통산 기록 → 수상. 재료는 lib/data loadFranchises (규칙 lib/franchise).
// 주소 ?season=코드 로 그 시즌 로스터를 연다. GA4: filter_change screen=team filter=season·leader, like_add/remove(LikeButton), fan_add/remove(FanButton — 지금 팀만)
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { mixHex } from "@/lib/images";
import { LEGEND_RULE_TEXT, majorAwardSummary, PLAYOFF_STAGE_LABELS, pctText, type PlayoffStage, type TeamLeaderKey, type TeamPageData } from "@/lib/franchise";
import ChipRow from "./ChipRow";
import FanButton from "./FanButton";
import LikeButton from "./LikeButton";
import PlayerAvatar from "./PlayerAvatar";
import TeamLogo from "./TeamLogo";
import { IconArrowRight, IconTrophy } from "./icons";
import { trackFilters } from "./track";

const NF = new Intl.NumberFormat("ko-KR");

function Card({ title, children, id, className = "" }: { title: string; children: React.ReactNode; id?: string; className?: string }) {
  return (
    <section id={id} aria-label={title} className={`surface-card rounded-container p-4 ${className}`}>
      <h2 className="text-h2 font-bold">{title}</h2>
      {children}
    </section>
  );
}

function StageChip({ stage }: { stage: PlayoffStage | null }) {
  if (!stage) return <span className="text-ink-3">–</span>;
  const gold = stage === "champion";
  return (
    <span
      className={`inline-flex items-center rounded-control px-1.5 py-0.5 text-caption font-bold ${gold ? "" : "bg-surface-2 text-ink-2"}`}
      style={gold ? { background: "var(--grade-s)", color: "var(--grade-s-ink)" } : undefined}
    >
      {PLAYOFF_STAGE_LABELS[stage]}
    </span>
  );
}

export default function TeamView({ data }: { data: TeamPageData }) {
  const { brand, totals, rows } = data;
  const [season, setSeason] = useState<number>(rows[0]?.seasonCode ?? 0);
  const [leader, setLeader] = useState<TeamLeaderKey>("pts");

  useEffect(() => {
    const q = Number(new URLSearchParams(window.location.search).get("season"));
    if (q && rows.some((r) => r.seasonCode === q)) setSeason(q);
  }, [rows]);

  function pickSeason(code: number, scroll = false) {
    setSeason(code);
    trackFilters("team", { season: code });
    const url = new URL(window.location.href);
    url.searchParams.set("season", String(code));
    window.history.replaceState(null, "", url);
    if (scroll) document.getElementById("roster")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  const row = rows.find((r) => r.seasonCode === season) ?? rows[0];
  const roster = data.rosters[String(season)] ?? [];
  const champSeasons = rows.filter((r) => r.stage === "champion");
  const leaderList = data.leaders.find((l) => l.key === leader);
  const dark = mixHex(brand.color.primary, "#000000", 0.6);
  const mid = mixHex(brand.color.primary, "#000000", 0.3);
  const seasonChips = useMemo(
    () => rows.map((r) => ({ value: r.seasonCode, label: r.label, highlight: r.stage === "champion" })),
    [rows],
  );

  const totalTiles: [string, string, string?][] = [
    ["시즌", `${totals.seasons}`],
    ["정규시즌 통산", `${NF.format(totals.wins)}승 ${NF.format(totals.losses)}패`, `승률 ${pctText(totals.pct)}`],
    ["챔프전 우승", `${totals.championships}회`, totals.runnerUps > 0 ? `준우승 ${totals.runnerUps}회` : undefined],
    ["정규리그 1위", `${totals.regularFirsts}회`],
    ["통합 우승", `${totals.doubles}회`, "정규 1위 + 우승"],
    ["플레이오프 진출", `${totals.playoffs}회`],
  ];

  return (
    <main className="pb-6">
      {/* ── 머리말 ── */}
      <section
        aria-label={`${brand.name} 소개`}
        style={{ background: `linear-gradient(160deg, ${brand.color.primary} 0%, ${mid} 55%, ${dark} 100%)`, color: brand.color.text }}
      >
        <div className="mx-auto flex max-w-5xl flex-col gap-3 px-4 pb-5 pt-6 sm:flex-row sm:items-center sm:gap-5">
          <span className="flex h-20 w-20 shrink-0 items-center justify-center rounded-container bg-white p-2 sm:h-24 sm:w-24">
            <TeamLogo logoUrl={brand.logoUrl} shortName={brand.shortName} color={brand.color} size={64} />
          </span>
          <div className="min-w-0">
            <p className="text-sub font-semibold opacity-85">
              {data.spanLabel}
              {!data.active && <span className="ml-2 rounded-control bg-black/25 px-2 py-0.5">추억의 팀</span>}
            </p>
            {/* deslop-ignore-next-line 11 */}
            <h1 className="mt-1 text-[2rem] font-black leading-[1.1] tracking-tight sm:text-5xl">{brand.name}</h1>
            {data.names.length > 1 && (
              <p className="mt-1 text-sub opacity-85">
                {data.names
                  .slice(1)
                  .map((n) => `${n.name} (${n.span})`)
                  .join(" · ")}
              </p>
            )}
            <div className="mt-3 flex flex-wrap gap-2">
              {data.active && <FanButton teamCode={brand.teamCode} label={brand.name} />}
              <LikeButton kind="team" target={brand.teamCode} label={brand.name} />
              {champSeasons.length > 0 && (
                <span className="inline-flex h-10 items-center gap-1.5 rounded-control px-3 text-sub font-bold" style={{ background: "var(--grade-s)", color: "var(--grade-s-ink)" }}>
                  <IconTrophy size={16} />
                  우승 {champSeasons.length}회
                </span>
              )}
            </div>
          </div>
        </div>
      </section>

      <div className="mx-auto mt-4 max-w-5xl space-y-4 px-4">
        {data.lineage.length > 0 && (
          <Card title="구단 계보">
            <p className="mt-1 text-sub text-ink-3">구단이 팔리면 KBL 은 새 팀 코드로 기록을 따로 셉니다. 이름을 누르면 그 팀 페이지로 가요.</p>
            <ol className="mt-3 flex flex-wrap items-center gap-x-1 gap-y-2">
              {data.lineage.map((l, i) => (
                <li key={l.teamCode} className="flex items-center gap-1">
                  {i > 0 && <IconArrowRight size={16} className="text-ink-3" />}
                  {l.teamCode === brand.teamCode ? (
                    <span className="inline-flex h-10 items-center gap-2 rounded-control border border-ink bg-surface-2 px-2.5 text-sub font-bold">
                      <TeamLogo logoUrl={l.logoUrl} shortName={l.shortName} color={l.color} size={20} />
                      {l.name}
                    </span>
                  ) : (
                    <Link
                      href={`/team/${l.teamCode}`}
                      className="focus-ring inline-flex h-10 items-center gap-2 rounded-control border border-line px-2.5 text-sub font-semibold text-ink transition-colors duration-200 hover:bg-surface-2"
                    >
                      <TeamLogo logoUrl={l.logoUrl} shortName={l.shortName} color={l.color} size={20} />
                      {l.name}
                      <span className="text-caption font-normal text-ink-3">{l.span}</span>
                    </Link>
                  )}
                </li>
              ))}
            </ol>
          </Card>
        )}

        <Card title="KBL 통산 성적">
          <dl className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {totalTiles.map(([label, value, sub]) => (
              <div key={label} className="rounded-card bg-surface-2 p-3">
                <dt className="text-caption text-ink-3">{label}</dt>
                <dd className="mt-0.5 text-body font-black tabular">{value}</dd>
                {sub && <dd className="text-caption text-ink-3">{sub}</dd>}
              </div>
            ))}
          </dl>
          {champSeasons.length > 0 && (
            <p className="mt-3 text-sub text-ink-2">
              <span className="font-semibold text-ink">우승 시즌</span>{" "}
              {champSeasons
                .map((r) => `${r.label}${r.regularFirst ? "(통합)" : ""}`)
                .reverse()
                .join(" · ")}
            </p>
          )}
          <p className="mt-2 text-caption text-ink-3">정규시즌 승패·순위는 경기 결과로 센 값, 플레이오프 4강·6강은 대진으로 판정한 값입니다(옛 시즌은 방식이 달라 다를 수 있음).</p>
        </Card>

        <Card title="시즌별 로스터" id="roster">
          <ChipRow label="시즌" chips={seasonChips} value={season} onChange={(v) => pickSeason(v)} scroll className="mt-3" />
          {row && (
            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sub text-ink-2">
              <span className="inline-flex items-center gap-2 font-semibold text-ink">
                <TeamLogo logoUrl={row.logoUrl} shortName={row.shortName} color={brand.color} size={24} />
                {row.name}
              </span>
              <span className="tabular">
                {row.wins}승 {row.losses}패{row.rank ? ` · ${row.rank}위` : ""}
                {row.ongoing ? " · 진행 중" : ""}
              </span>
              {row.regularFirst && <span className="font-semibold text-ink">정규리그 1위</span>}
              <StageChip stage={row.stage} />
            </div>
          )}
          {roster.length === 0 ? (
            <p className="mt-3 text-sub text-ink-3">이 시즌 선수 기록이 없습니다</p>
          ) : (
            <ul className="mt-3 divide-y divide-line">
              <li className="grid grid-cols-[minmax(0,1fr)_2.5rem_2.5rem_2.5rem] gap-2 pb-2 text-caption font-semibold text-ink-3 sm:grid-cols-[minmax(0,1fr)_3rem_3rem_3.5rem_3.5rem_3.5rem]">
                <span>선수 (경기당)</span>
                <span className="hidden text-right sm:block">경기</span>
                <span className="hidden text-right sm:block">분</span>
                <span className="text-right">득점</span>
                <span className="text-right">리바</span>
                <span className="text-right">어시</span>
              </li>
              {roster.map((p) => (
                <li key={p.id}>
                  <Link
                    href={`/player/${p.id}?season=${season}`}
                    className="focus-ring-inset grid min-h-12 grid-cols-[minmax(0,1fr)_2.5rem_2.5rem_2.5rem] items-center gap-2 py-1.5 text-sub transition-colors duration-200 hover:bg-surface-2 sm:grid-cols-[minmax(0,1fr)_3rem_3rem_3.5rem_3.5rem_3.5rem]"
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <PlayerAvatar photoUrl={p.photoUrl} nameKo={p.name} color={brand.color} size={32} />
                      <span className="min-w-0">
                        <span className="block truncate font-semibold text-ink">{p.name}</span>
                        <span className="block text-caption text-ink-3">
                          {[p.pos, p.foreign ? "외국인" : null].filter(Boolean).join(" · ")}
                          <span className="sm:hidden tabular">{p.pos || p.foreign ? " · " : ""}{p.gp}경기</span>
                        </span>
                      </span>
                    </span>
                    <span className="hidden text-right tabular text-ink-2 sm:block">{p.gp}</span>
                    <span className="hidden text-right tabular text-ink-2 sm:block">{p.mpg.toFixed(1)}</span>
                    <span className="text-right font-semibold tabular text-ink">{p.ppg.toFixed(1)}</span>
                    <span className="text-right tabular text-ink-2">{p.rpg.toFixed(1)}</span>
                    <span className="text-right tabular text-ink-2">{p.apg.toFixed(1)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="시즌별 성적">
          <p className="mt-1 text-sub text-ink-3">줄을 누르면 위에서 그 시즌 로스터를 보여 줘요.</p>
          <ul className="mt-3 divide-y divide-line">
            <li className="grid grid-cols-[3.25rem_1.5rem_minmax(0,1fr)_3rem_3.75rem] gap-2 pb-2 text-caption font-semibold text-ink-3 sm:grid-cols-[4rem_minmax(0,1fr)_6rem_4rem_3.5rem_4.5rem_minmax(0,1fr)]">
              <span>시즌</span>
              <span>
                <span className="sm:hidden">팀</span>
                <span className="hidden sm:inline">팀 이름</span>
              </span>
              <span className="text-right">승-패</span>
              <span className="text-right">순위</span>
              <span className="hidden text-right sm:block">승률</span>
              <span className="text-right">PO</span>
              <span className="hidden sm:block">득점 1위</span>
            </li>
            {rows.map((r) => (
              <li key={r.seasonCode}>
                <button
                  type="button"
                  onClick={() => pickSeason(r.seasonCode, true)}
                  aria-pressed={r.seasonCode === season}
                  className={`focus-ring-inset grid min-h-12 w-full cursor-pointer grid-cols-[3.25rem_1.5rem_minmax(0,1fr)_3rem_3.75rem] items-center gap-2 py-1.5 text-left text-sub transition-colors duration-200 hover:bg-surface-2 sm:grid-cols-[4rem_minmax(0,1fr)_6rem_4rem_3.5rem_4.5rem_minmax(0,1fr)] ${
                    r.seasonCode === season ? "bg-surface-2" : ""
                  }`}
                >
                  <span className="font-semibold tabular text-ink">{r.label}</span>
                  <span className="flex min-w-0 items-center gap-1.5 text-ink-2">
                    <TeamLogo logoUrl={r.logoUrl} shortName={r.shortName} color={brand.color} size={20} />
                    <span className="hidden truncate sm:inline">{r.name}</span>
                  </span>
                  <span className="text-right tabular text-ink">
                    {r.wins}-{r.losses}
                  </span>
                  <span className="text-right tabular text-ink-2">
                    {r.regularFirst ? <span className="font-bold text-ink">1위</span> : r.rank ? `${r.rank}위` : "–"}
                  </span>
                  <span className="hidden text-right tabular text-ink-2 sm:block">{pctText(r.pct)}</span>
                  <span className="text-right">{r.ongoing ? <span className="text-caption text-ink-3">진행 중</span> : <StageChip stage={r.stage} />}</span>
                  <span className="hidden truncate text-ink-2 sm:block">
                    {r.topScorer ? `${r.topScorer.name} ${r.topScorer.ppg.toFixed(1)}` : "–"}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </Card>

        <Card title={data.legends.length > 0 ? `레전드 ${data.legends.length}명` : "가장 오래 뛴 선수"}>
          <p className="mt-1 text-sub text-ink-3">
            {data.legends.length > 0 ? `기준: ${LEGEND_RULE_TEXT}.` : "이 팀은 레전드 기준(10시즌 이상)을 넘은 선수가 없어 오래 뛴 순으로 보여 줘요."}
          </p>
          <ul className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {(data.legends.length > 0 ? data.legends : data.longest).map((l) => (
              <li key={l.id}>
                <Link
                  href={`/player/${l.id}`}
                  className="focus-ring flex min-h-16 items-center gap-3 rounded-card border border-line p-2.5 transition-colors duration-200 hover:bg-surface-2"
                >
                  <PlayerAvatar photoUrl={l.photoUrl} nameKo={l.name} color={brand.color} size={48} />
                  <span className="min-w-0">
                    <span className="block truncate text-body font-bold text-ink">{l.name}</span>
                    <span className="block text-caption text-ink-3 tabular">
                      {l.seasonCodes.length}시즌 · {l.span} · {NF.format(l.games)}경기
                    </span>
                    <span className="block text-caption text-ink-2 tabular">
                      경기당 {(l.pts / l.games).toFixed(1)}점 {(l.reb / l.games).toFixed(1)}리바 {(l.ast / l.games).toFixed(1)}어시
                    </span>
                    {l.majorAwards.length > 0 && <span className="mt-0.5 block text-caption font-semibold text-ink">{majorAwardSummary(l.majorAwards)}</span>}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </Card>

        <Card title="팀 통산 기록">
          <p className="mt-1 text-sub text-ink-3">이 팀 소속으로 남긴 정규시즌 기록의 합계</p>
          <ChipRow
            label="부문"
            chips={data.leaders.map((l) => ({ value: l.key, label: l.label }))}
            value={leader}
            onChange={(v) => {
              setLeader(v);
              trackFilters("team", { leader: v });
            }}
            scroll
            className="mt-3"
          />
          <ol className="mt-3 divide-y divide-line">
            {(leaderList?.list ?? []).map((p, i) => (
              <li key={p.id}>
                <Link
                  href={`/player/${p.id}`}
                  className="focus-ring-inset flex min-h-12 items-center gap-3 py-1.5 transition-colors duration-200 hover:bg-surface-2"
                >
                  <span className="w-5 text-right text-sub font-bold tabular text-ink-3">{i + 1}</span>
                  <PlayerAvatar photoUrl={p.photoUrl} nameKo={p.name} color={brand.color} size={32} />
                  <span className="min-w-0 flex-1 truncate text-body font-semibold text-ink">{p.name}</span>
                  <span className="text-body font-bold tabular text-ink">{NF.format(p.value)}</span>
                </Link>
              </li>
            ))}
          </ol>
        </Card>

        {data.awards.length > 0 && (
          <Card title="수상 기록">
            <p className="mt-1 text-sub text-ink-3">이 팀 소속으로 받은 KBL 시상</p>
            <ul className="mt-3 divide-y divide-line">
              {data.awards.map((a) => (
                <li key={`${a.seasonCode}-${a.key}-${a.playerNo}`} className="flex min-h-11 items-center gap-3 py-1.5 text-sub">
                  <span className="w-12 shrink-0 font-semibold tabular text-ink-3">{a.label}</span>
                  <span className="w-24 shrink-0 text-ink-2">{a.awardLabel}</span>
                  <Link href={`/player/${a.playerNo}?season=${a.seasonCode}`} className="focus-ring min-w-0 truncate rounded-md font-semibold text-ink underline-offset-2 hover:underline">
                    {a.name}
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
        )}

        <p className="text-sub">
          <Link href="/teams" className="focus-ring inline-flex h-10 items-center gap-1 rounded-control font-semibold text-ink underline underline-offset-2">
            모든 팀 보기
          </Link>
        </p>
      </div>
    </main>
  );
}
