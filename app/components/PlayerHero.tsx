// 선수 페이지 머리말 (PLAN.md §2-2 ①, §5-4): 최근 시즌 팀 색 배경 + 큰 세로 사진 + 로고 + 이름·소속·활동 기간,
// 이름 아래 국적 배지(국내/외국/아시아쿼터)·활동 기간, 프로필 한 줄(포지션·키·몸무게·등번호·드래프트 — 선수 마스터),
// 그 아래 통산 요약 4칸과 소속 팀 이력. 계산은 lib/metrics careerSummary, 표기는 lib/career.
// 머리말 팀 색은 가장 최근 시즌 팀 (카드 영역은 고른 시즌 팀 색을 따로 쓴다).
import type { CareerSeason, PlayerIndexEntry, TeamColor } from "@/lib/types";
import { careerSummary } from "@/lib/metrics";
import { activeSpanLabel, profileFacts, seasonShortLabel, teamStints } from "@/lib/career";
import { nationalityOf, NATIONALITY_LABELS } from "@/lib/roster";
import { mixHex, teamShortLabel } from "@/lib/images";
import PlayerAvatar from "./PlayerAvatar";
import TeamLogo from "./TeamLogo";

const FALLBACK: TeamColor = { primary: "#6B7280", secondary: "#9CA3AF", text: "#fff" };
const NF1 = new Intl.NumberFormat("ko-KR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const NF0 = new Intl.NumberFormat("ko-KR");

interface Props {
  entry: PlayerIndexEntry;
  /** 시즌 오름차순 */
  seasons: CareerSeason[];
}

export default function PlayerHero({ entry, seasons }: Props) {
  const latest = seasons[seasons.length - 1];
  const first = seasons[0];
  const team = latest?.team ?? null;
  const color = team?.color ?? FALLBACK;
  const teamName = team?.shortName ?? latest?.teamShort ?? "";
  const dark = mixHex(color.primary, "#000000", 0.62);
  const mid = mixHex(color.primary, "#000000", 0.3);
  const sum = careerSummary(seasons);
  const span = first && latest ? activeSpanLabel(first.seasonLabel, latest.seasonLabel, seasons.length) : "";
  const stints = teamStints(seasons);
  const facts = profileFacts(entry);
  const tiles = [
    { label: "통산 경기", value: NF0.format(sum.games), unit: "경기" },
    { label: "경기당 득점", value: NF1.format(sum.points), unit: "" },
    { label: "경기당 리바운드", value: NF1.format(sum.reb), unit: "" },
    { label: "경기당 어시스트", value: NF1.format(sum.ast), unit: "" },
  ];

  return (
    <section aria-label={`${entry.nameKo} 선수 소개`}>
      {/* ── 팀 색 띠 + 사진 ── */}
      <div
        className="relative overflow-hidden"
        style={{ background: `linear-gradient(160deg, ${color.primary} 0%, ${mid} 55%, ${dark} 100%)`, color: color.text }}
      >
        {/* 장식: 최근 팀 약칭 큰 글씨 */}
        <span
          aria-hidden
          className="pointer-events-none absolute -right-3 top-2 select-none whitespace-nowrap text-[7.5rem] font-black leading-none tracking-tighter opacity-10 sm:text-[11rem]"
        >
          {teamShortLabel(teamName, 5)}
        </span>
        <div className="relative mx-auto flex min-h-[250px] max-w-5xl items-end px-4 sm:min-h-[300px]">
          <div className="relative z-10 min-w-0 flex-1 pb-5 pt-5 pr-2">
            <div className="flex items-center gap-2">
              <span className="inline-flex rounded-xl bg-white p-1 shadow-sm">
                <TeamLogo logoUrl={team?.logoUrl} shortName={teamName} color={color} size={40} />
              </span>
              <span className="text-sub font-semibold opacity-90 sm:text-body">
                {latest ? `${seasonShortLabel(latest.seasonLabel)} ${teamShortLabel(teamName)}` : ""}
              </span>
            </div>
            <h1 className="mt-3 text-[2rem] font-black leading-[1.1] tracking-tight [overflow-wrap:anywhere] sm:text-5xl">
              {entry.nameKo}
            </h1>
            <p className="mt-1 truncate text-sub font-medium uppercase tracking-wide opacity-80 sm:text-body">{entry.nameEn}</p>
            <div className="mt-3 flex flex-wrap gap-1.5 text-sub font-semibold">
              <span className="rounded-full px-2 py-0.5" style={{ background: "rgba(255,255,255,0.18)" }}>
                {NATIONALITY_LABELS[nationalityOf(entry)]}
              </span>
              <span className="rounded-full px-2 py-0.5" style={{ background: "rgba(0,0,0,0.25)" }}>
                {span}
              </span>
            </div>
            {facts.length > 0 && (
              <dl className="mt-3 flex max-w-md flex-wrap gap-x-3 gap-y-1 text-sub sm:text-body">
                {facts.map((f) => (
                  <div key={f.label} className="flex items-baseline gap-1">
                    <dt className="opacity-75">{f.label}</dt>
                    <dd className="font-bold">{f.value}</dd>
                  </div>
                ))}
              </dl>
            )}
          </div>
          <div className="relative -mr-2 shrink-0 self-end sm:mr-4">
            <span className="sm:hidden">
              <PlayerAvatar photoUrl={entry.photoUrl} nameKo={entry.nameKo} color={color} variant="portrait" size={210} />
            </span>
            <span className="hidden sm:inline">
              <PlayerAvatar photoUrl={entry.photoUrl} nameKo={entry.nameKo} color={color} variant="portrait" size={280} />
            </span>
          </div>
        </div>
      </div>

      {/* ── 통산 요약 + 소속 이력 ── */}
      <div className="mx-auto max-w-5xl px-4">
        <dl className="-mt-px grid grid-cols-4 overflow-hidden rounded-b-2xl border border-t-0 border-line bg-surface">
          {tiles.map((t, i) => (
            <div key={t.label} className={`min-w-0 px-2 py-3 text-center sm:px-4 ${i > 0 ? "border-l border-line" : ""}`}>
              <dt className="truncate text-caption font-medium text-ink-3 sm:text-sub">
                {i === 0 ? t.label : <><span className="hidden sm:inline">경기당 </span>{t.label.replace("경기당 ", "")}</>}
              </dt>
              <dd className="mt-0.5 text-xl font-bold tracking-tight text-ink sm:text-3xl">{t.value}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-1.5 text-caption text-ink-3">
          통산 {sum.seasons}시즌 정규시즌 기준 · 경기당 값은 전 시즌 합계 ÷ 전 시즌 경기 수
        </p>

        <div className="mt-4">
          <p id="stints-title" className="text-sub font-semibold text-ink-2">소속 팀 이력</p>
          <ol aria-labelledby="stints-title" className="mt-1.5 flex flex-wrap gap-1.5">
            {stints.map((st, i) => {
              // 같은 팀 코드라도 시즌마다 이름·로고가 다를 수 있어(KT&G → 정관장) 구간 마지막 시즌의 팀 정보를 쓴다
              const s = seasons.find((x) => x.seasonLabel === st.toLabel);
              const t = s?.team ?? undefined;
              const name = t?.shortName ?? s?.teamShort ?? st.teamCode;
              const from = seasonShortLabel(st.fromLabel);
              const to = seasonShortLabel(st.toLabel);
              return (
                <li
                  key={`${st.teamCode}-${i}`}
                  className="flex items-center gap-1.5 rounded-full border border-line bg-surface py-1 pl-1 pr-2.5 text-sub"
                >
                  <TeamLogo logoUrl={t?.logoUrl} shortName={name} color={t?.color} size={20} />
                  <span className="font-semibold text-ink">{teamShortLabel(name)}</span>
                  <span className="text-ink-3">
                    {from === to ? from : `${from}~${to}`}
                  </span>
                </li>
              );
            })}
          </ol>
        </div>
      </div>
    </section>
  );
}
