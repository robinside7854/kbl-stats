// 시즌 어워즈 (2026-10-02 사용자 요청: 마감된 시즌 리더보드 위에 그 시즌 개인 수상 전부를 "어워즈" 형태로).
// 재료: 시즌 파일 seasonAwards (공홈 역대수상현황 → scripts/awards.ts → process). 여기서는 화면 순서·묶음·표기만 — 순수 함수.
import type { CardTeam, SeasonAwardKey, SeasonAwards } from "./types";

// 2026-10-02 사용자: 기록 부문(득점상 등)·올스타전은 어워즈에서 뺀다 (시즌 파일 seasonAwards 에는 남아 있음)
export type AwardGroup = "major" | "team5" | "regular" | "period";

/** 화면 순서·이름·묶음. 표에 없는 부문(옛 시즌의 기록 부문상·라운드 MVP 등)은 자동으로 빠진다 */
export const SEASON_AWARD_DEFS: readonly { key: SeasonAwardKey; label: string; group: AwardGroup }[] = [
  { key: "mvp", label: "정규리그 MVP", group: "major" },
  { key: "foreignMvp", label: "외국선수 MVP", group: "major" },
  { key: "finalsMvp", label: "챔프전 MVP", group: "major" },
  { key: "rookie", label: "신인상", group: "major" },
  { key: "best5", label: "베스트5", group: "team5" },
  { key: "defense5", label: "수비 5걸", group: "team5" },
  { key: "defensive", label: "최우수 수비상", group: "regular" },
  { key: "sixthMan", label: "식스맨상", group: "regular" },
  { key: "mip", label: "기량 발전상", group: "regular" },
  { key: "fairPlay", label: "페어플레이상", group: "regular" },
  { key: "popularity", label: "인기상", group: "regular" },
  { key: "roundMvp", label: "라운드 MVP", group: "period" },
  { key: "monthMvp", label: "월간 MVP", group: "period" },
];

export const AWARD_GROUP_LABELS: Record<AwardGroup, string> = {
  major: "주요 시상",
  team5: "올-KBL 팀",
  regular: "정규리그 시상",
  period: "라운드·월간 MVP",
};

export interface AwardWinnerView {
  playerNo: string | null;
  /** 색인 이름(공식 표기) — 선수를 못 찾으면 수상 표 이름 */
  name: string;
  /** 그 시즌 팀 한글 약칭, 팀을 모르면 수상 표 팀 표기 */
  teamLabel: string;
  team: CardTeam | null;
  photoUrl: string | null;
  note: string | null;
  /** 선수 상세 그 시즌 (/player/번호?season=코드), 선수를 모르면 null */
  href: string | null;
}

export interface AwardItemView {
  key: SeasonAwardKey;
  label: string;
  winners: AwardWinnerView[];
}

export interface SeasonAwardsView {
  seasonCode: number;
  groups: { group: AwardGroup; label: string; items: AwardItemView[] }[];
  regular: SeasonAwards["regular"];
  finals: SeasonAwards["finals"];
  /** 챔피언·준우승·정규리그 1·2위 팀 이름(수상 표 표기) → 팀 코드 — 팀 페이지 링크용 (2026-10-14), 못 찾으면 없음 */
  teamCodes: Record<string, string>;
}

/** 수상 표 팀 이름("KCC"·"현대모비스") → 그 시즌 팀 코드. 공백 무시 같은 약칭 → 이름 끝맞춤. 없거나 둘 이상이면 null */
export function teamCodeOfName(name: string, teams: readonly CardTeam[]): string | null {
  const norm = (x: string) => x.replace(/\s+/g, "");
  const n = norm(name);
  if (!n) return null;
  const exact = teams.filter((t) => norm(t.shortName) === n);
  if (exact.length === 1) return exact[0].teamCode;
  const ends = teams.filter((t) => norm(t.shortName).endsWith(n) || n.endsWith(norm(t.shortName)));
  return ends.length === 1 ? ends[0].teamCode : null;
}

/**
 * 시즌 파일 seasonAwards → 화면 묶음. 수상이 하나도 없으면 null (시즌이 안 끝났거나 수상 raw 가 없음 → 화면에 안 보임).
 * lookup: 선수 번호 → 공식 이름·사진 (색인). 라운드·월간 MVP 는 note(“1라운드”) 순서 그대로.
 */
export function buildSeasonAwardsView(
  sa: SeasonAwards | null | undefined,
  seasonCode: number,
  teams: readonly CardTeam[],
  lookup: (playerNo: string) => { nameKo: string; photoUrl: string | null } | null,
): SeasonAwardsView | null {
  if (!sa || sa.awards.every((a) => a.winners.length === 0)) return null;
  const teamByCode = new Map(teams.map((t) => [t.teamCode, t]));
  const byKey = new Map(sa.awards.map((a) => [a.key, a]));
  const groups: SeasonAwardsView["groups"] = [];
  for (const def of SEASON_AWARD_DEFS) {
    const a = byKey.get(def.key);
    if (!a || a.winners.length === 0) continue;
    const winners = a.winners.map((w): AwardWinnerView => {
      const info = w.playerNo ? lookup(w.playerNo) : null;
      const team = w.teamCode ? teamByCode.get(w.teamCode) ?? null : null;
      return {
        playerNo: w.playerNo,
        name: info?.nameKo ?? w.name,
        teamLabel: team?.shortName ?? w.team,
        team,
        photoUrl: info?.photoUrl ?? null,
        note: w.note,
        href: w.playerNo ? `/player/${w.playerNo}?season=${seasonCode}` : null,
      };
    });
    let g = groups.find((x) => x.group === def.group);
    if (!g) groups.push((g = { group: def.group, label: AWARD_GROUP_LABELS[def.group], items: [] }));
    g.items.push({ key: def.key, label: def.label, winners });
  }
  const teamCodes: Record<string, string> = {};
  for (const name of [sa.finals?.champion, sa.finals?.runnerUp, sa.regular?.first, sa.regular?.second]) {
    const code = name ? teamCodeOfName(name, teams) : null;
    if (name && code) teamCodes[name] = code;
  }
  return { seasonCode, groups, regular: sa.regular, finals: sa.finals, teamCodes };
}
