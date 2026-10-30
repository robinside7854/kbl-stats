// 기록 탭 "프로필" (2026-10-30 사용자 요청: 키·몸무게처럼 받아 둔 정보로 선수 줄 세우기) — 순수 함수만.
// 부문 두 묶음: 프로필(키·몸무게·체격·나이·뛴 시즌·거친 구단) + 키 대비 기록(단신 리바운드·단신 블록·장신 3점%·키 대비 리바운드).
// 기간 = 시즌 하나(그 시즌에 뛴 선수, 나이는 그 시즌 개막일 기준) 또는 역대 전체. 재료는 lib/data loadProfileRankLists 가 모은다.
// 키·몸무게는 KBL 선수 마스터의 지금 값 하나뿐이라 옛 시즌에도 같은 값을 쓴다(시즌별 키는 없음).

export type ProfileRankKey =
  | "tall" | "short" | "weight" | "bmi" | "old" | "young" | "seasons" | "teams"
  | "smallReb" | "smallBlk" | "bigTp" | "rebOverHeight";

export interface ProfileRankDef {
  key: ProfileRankKey;
  label: string;
  unit: string;
  /** asc = 작을수록 위 (키 작은 순·최연소) */
  order: "desc" | "asc";
  /** profile = 선수 정보만, height = 키 + 그 기간 기록 */
  kind: "profile" | "height";
}

/** 단신·장신 기준 (우리 규칙): 185cm 이하·200cm 이상 */
export const SMALL_MAX_CM = 185;
export const BIG_MIN_CM = 200;
/** 역대 전체 기간의 키 대비 기록은 통산 200경기 이상, 장신 3점%는 통산 3점 시도 200개 이상 */
export const PROFILE_CAREER_MIN_GAMES = 200;
export const PROFILE_CAREER_MIN_TPA = 200;

export const PROFILE_RANK_DEFS: readonly ProfileRankDef[] = [
  { key: "tall", label: "키 큰 순", unit: "cm", order: "desc", kind: "profile" },
  { key: "short", label: "키 작은 순", unit: "cm", order: "asc", kind: "profile" },
  { key: "weight", label: "몸무게", unit: "kg", order: "desc", kind: "profile" },
  { key: "bmi", label: "체격(BMI)", unit: "", order: "desc", kind: "profile" },
  { key: "old", label: "최고령", unit: "세", order: "desc", kind: "profile" },
  { key: "young", label: "최연소", unit: "세", order: "asc", kind: "profile" },
  { key: "seasons", label: "뛴 시즌", unit: "시즌", order: "desc", kind: "profile" },
  { key: "teams", label: "거친 구단", unit: "팀", order: "desc", kind: "profile" },
  { key: "smallReb", label: `단신 리바운드`, unit: "개", order: "desc", kind: "height" },
  { key: "smallBlk", label: `단신 블록`, unit: "개", order: "desc", kind: "height" },
  { key: "bigTp", label: `장신 3점%`, unit: "%", order: "desc", kind: "height" },
  { key: "rebOverHeight", label: "키 대비 리바운드", unit: "개", order: "desc", kind: "height" },
];

export const profileRankDef = (key: string): ProfileRankDef => PROFILE_RANK_DEFS.find((d) => d.key === key) ?? PROFILE_RANK_DEFS[0];

/** 목록 키 "기간:부문" — 기간 = "all"(역대 전체) 또는 시즌 코드 */
export const profileListKey = (scope: number | "all", key: string) => `${scope}:${key}`;

/** 시즌 개막일 (나이 기준일): "2025-2026" → "2025-10-01", 한 해 시즌 "1997" → "1997-02-01"(1997 시즌은 2월 개막) */
export function seasonOpeningDate(label: string): string | null {
  const m = /^(\d{4})(-\d{4})?$/.exec(label);
  if (!m) return null;
  return m[2] ? `${m[1]}-10-01` : `${m[1]}-02-01`;
}

const DAY_MS = 86_400_000;
/** 그날 나이를 일 수로 (같은 만 나이끼리도 줄 세우려고). 날짜가 틀리거나 태어나기 전이면 null */
export function ageInDays(birthday: string | null | undefined, on: string): number | null {
  if (!birthday || !/^\d{4}-\d{2}-\d{2}$/.test(birthday) || !/^\d{4}-\d{2}-\d{2}$/.test(on)) return null;
  const d = Math.round((Date.parse(`${on}T00:00:00Z`) - Date.parse(`${birthday}T00:00:00Z`)) / DAY_MS);
  return Number.isFinite(d) && d >= 0 ? d : null;
}

/** BMI = 몸무게(kg) ÷ 키(m)², 소수 첫째 자리. 값이 없으면 null */
export function bmiOf(heightCm: number | null | undefined, weightKg: number | null | undefined): number | null {
  if (!heightCm || !weightKg || heightCm <= 0 || weightKg <= 0) return null;
  return Math.round((weightKg / (heightCm / 100) ** 2) * 10) / 10;
}

/** 구단 뿌리: 매각으로 코드가 바뀐 구단(team-lineage successor)은 마지막 구단 코드 하나로 본다 — 같은 구단에 남은 선수를 이적으로 세지 않게 */
export function franchiseRootOf(code: string, successor: Readonly<Record<string, string>>): string {
  const seen = new Set<string>();
  let c = code;
  while (successor[c] && !seen.has(c)) {
    seen.add(c);
    c = successor[c];
  }
  return c;
}

/**
 * 시즌 순서대로의 팀 코드 → 구단이 바뀐 지점마다 한 칸 (같은 구단으로 돌아오면 다시 한 칸).
 * 반환: 칸마다 그 칸 첫 시즌의 index. teams = 서로 다른 구단 수
 */
export function teamPathOf(codes: readonly string[], successor: Readonly<Record<string, string>>): { stints: number[]; teams: number } {
  const roots = codes.map((c) => franchiseRootOf(c, successor));
  const stints: number[] = [];
  roots.forEach((r, i) => {
    if (i === 0 || r !== roots[i - 1]) stints.push(i);
  });
  return { stints, teams: new Set(roots).size };
}

/** 직선 맞추기 (최소제곱): y ≈ a + b·x. 점이 2개 미만이거나 x 가 모두 같으면 null */
export function linearFit(points: readonly { x: number; y: number }[]): { a: number; b: number } | null {
  const n = points.length;
  if (n < 2) return null;
  const mx = points.reduce((s, p) => s + p.x, 0) / n;
  const my = points.reduce((s, p) => s + p.y, 0) / n;
  let sxx = 0;
  let sxy = 0;
  for (const p of points) {
    sxx += (p.x - mx) ** 2;
    sxy += (p.x - mx) * (p.y - my);
  }
  if (sxx === 0) return null;
  const b = sxy / sxx;
  return { a: my - b * mx, b };
}

/** 시즌 기간 장신 3점% 최소 시도: 그 시즌 최다 출전 경기 × 0.6 (54경기면 32개), 적어도 10개 */
export const seasonMinTpa = (maxGames: number) => Math.max(10, Math.round(maxGames * 0.6));

/** 한 선수의 재료 (lib/data 가 기간마다 만든다) */
export interface ProfileRankInput {
  id: string;
  origin: "domestic" | "foreign";
  heightCm: number | null;
  weightKg: number | null;
  birthday: string | null;
  /** 최고령·최연소 나이 기준일 (시즌 기간 = 그 시즌 개막일, 역대 = 마지막 시즌·첫 시즌 개막일) */
  oldOn: string | null;
  youngOn: string | null;
  /** 그 기간까지 뛴 시즌 수·서로 다른 구단 수, 구단 칸 이름("KCC → SK") */
  seasons: number;
  teams: number;
  teamPath: string[];
  /** 둘째 줄 재료 */
  positionLabel: string | null;
  teamShort: string;
  /** "09-26" 같은 기간 */
  span: string;
  /** 그 기간 기록 — 표본 기준을 채웠을 때만 (아니면 null → 키 대비 부문에서 빠짐) */
  stat: { games: number; reb: number; blk: number; tpm: number; tpa: number } | null;
  /** 장신 3점% 최소 시도 */
  minTpa: number;
  /** 키 대비 리바운드 (같은 국적 묶음 직선과의 차, attachRebResiduals 가 채움) */
  rebResidual?: number | null;
}

/**
 * 키 대비 리바운드: 국내 선수는 국내끼리, 외국인(외국+아시아쿼터)은 외국인끼리 "키 → 경기당 리바운드" 직선을 맞추고,
 * 각자 그 직선(같은 키 평균)보다 몇 개 더 잡는지. 키·기록이 있는 선수만, 묶음에 5명 미만이면 셈하지 않는다.
 */
export function attachRebResiduals(inputs: ProfileRankInput[]): ProfileRankInput[] {
  const out = inputs.map((p) => ({ ...p, rebResidual: null as number | null }));
  for (const origin of ["domestic", "foreign"] as const) {
    const group = out.filter((p) => p.origin === origin && p.heightCm && p.stat && p.stat.games > 0);
    if (group.length < 5) continue;
    const fit = linearFit(group.map((p) => ({ x: p.heightCm!, y: p.stat!.reb / p.stat!.games })));
    if (!fit) continue;
    for (const p of group) p.rebResidual = p.stat!.reb / p.stat!.games - (fit.a + fit.b * p.heightCm!);
  }
  return out;
}

const per = (n: number, g: number) => (g > 0 ? n / g : 0);

/** 부문 값 (순위 기준, 그대로의 값). 해당 없으면 null */
export function profileRankValue(p: ProfileRankInput, key: ProfileRankKey): number | null {
  const h = p.heightCm;
  const s = p.stat;
  switch (key) {
    case "tall":
    case "short":
      return h ?? null;
    case "weight":
      return p.weightKg ?? null;
    case "bmi":
      return bmiOf(h, p.weightKg);
    case "old":
      return p.oldOn ? ageInDays(p.birthday, p.oldOn) : null;
    case "young":
      return p.youngOn ? ageInDays(p.birthday, p.youngOn) : null;
    case "seasons":
      return p.seasons > 0 ? p.seasons : null;
    case "teams":
      return p.teams > 0 ? p.teams : null;
    case "smallReb":
      return h && h <= SMALL_MAX_CM && s ? per(s.reb, s.games) : null;
    case "smallBlk":
      return h && h <= SMALL_MAX_CM && s ? per(s.blk, s.games) : null;
    case "bigTp":
      return h && h >= BIG_MIN_CM && s && s.tpa >= p.minTpa && s.tpa > 0 ? (s.tpm / s.tpa) * 100 : null;
    case "rebOverHeight":
      return p.rebResidual ?? null;
  }
}

/** 같은 값 = 같은 순위가 되도록 반올림한 정수 (asc 부문은 부호를 바꿔 늘 "클수록 위") */
export function profileRankNum(value: number, key: ProfileRankKey): number {
  const def = profileRankDef(key);
  const scale = key === "smallBlk" ? 100 : key === "bmi" || key === "bigTp" || key === "smallReb" || key === "rebOverHeight" ? 10 : 1;
  const n = Math.round(value * scale);
  return def.order === "asc" ? -n : n;
}

/** 일 수 → 만 나이 (365.25일) */
export const yearsOf = (days: number) => Math.floor(days / 365.2425);

/** 큰 숫자·숫자 아래 작은 글씨 */
export function formatProfileRank(p: ProfileRankInput, key: ProfileRankKey, value: number): { value: string; note: string | null } {
  const s = p.stat;
  switch (key) {
    case "tall":
    case "short":
      return { value: String(value), note: p.weightKg ? `${p.weightKg}kg` : null };
    case "weight":
      return { value: String(value), note: p.heightCm ? `${p.heightCm}cm` : null };
    case "bmi":
      return { value: value.toFixed(1), note: `${p.heightCm}cm · ${p.weightKg}kg` };
    case "old":
    case "young":
      return { value: String(yearsOf(value)), note: p.birthday ? `${p.birthday.replace(/-/g, ".")}생` : null };
    case "seasons":
      return { value: String(value), note: p.span || null };
    case "teams":
      return { value: String(value), note: null };
    case "smallReb":
      return { value: value.toFixed(1), note: "경기당" };
    case "smallBlk":
      return { value: value.toFixed(2), note: "경기당" };
    case "bigTp":
      return { value: value.toFixed(1), note: s ? `${s.tpm}/${s.tpa}` : null };
    case "rebOverHeight":
      return { value: `${Math.round(value * 10) > 0 ? "+" : ""}${(Math.round(value * 10) / 10 || 0).toFixed(1)}`, note: s ? `경기당 ${per(s.reb, s.games).toFixed(1)}개` : null };
  }
}

/** 둘째 줄: 포지션 · 팀 · (키 대비 부문은 키 · 경기 수, 거친 구단은 구단 순서) */
export function profileRankSub(p: ProfileRankInput, key: ProfileRankKey): string {
  if (key === "teams") return p.teamPath.join(" → ");
  const parts = [p.positionLabel, p.teamShort].filter(Boolean) as string[];
  if (profileRankDef(key).kind === "height") {
    if (p.heightCm) parts.push(`${p.heightCm}cm`);
    if (p.stat) parts.push(`${p.stat.games}경기`);
  } else if (key !== "seasons" && p.span) parts.push(p.span);
  return parts.join(" · ");
}

/** 순위 한 줄 (값이 있는 선수만, 위가 먼저). 같은 값이면 시즌 수 많은 순 → 선수 번호 */
export function rankProfile(inputs: readonly ProfileRankInput[], key: ProfileRankKey): (ProfileRankInput & { value: number; num: number })[] {
  return inputs
    .flatMap((p) => {
      const v = profileRankValue(p, key);
      return v === null ? [] : [{ ...p, value: v, num: profileRankNum(v, key) }];
    })
    .sort((a, b) => b.num - a.num || b.seasons - a.seasons || a.id.localeCompare(b.id));
}

/** 목록 아래 안내 */
export function profileRankNote(key: ProfileRankKey, scope: "all" | "season"): string {
  const def = profileRankDef(key);
  const base = "키·몸무게는 KBL 선수 등록 정보의 지금 값입니다.";
  if (key === "old" || key === "young")
    return scope === "season"
      ? "그 시즌 개막일 기준 만 나이입니다. 생년월일이 없는 선수는 빠져요."
      : key === "old"
        ? "마지막으로 뛴 시즌 개막일 기준 만 나이입니다. 생년월일이 없는 선수는 빠져요."
        : "처음 뛴 시즌 개막일 기준 만 나이입니다. 생년월일이 없는 선수는 빠져요.";
  if (key === "seasons") return "정규시즌에 한 경기라도 뛴 시즌을 셉니다. 시즌을 고르면 그 시즌까지 센 값이에요.";
  if (key === "teams") return "매각으로 이름·코드만 바뀐 구단은 한 팀으로 셉니다. 시즌을 고르면 그 시즌까지 센 값이에요.";
  if (def.kind === "profile") return base;
  const sample = scope === "season" ? "그 시즌 표본 기준(경기 수·출전 시간)을 채운 선수만" : `통산 ${PROFILE_CAREER_MIN_GAMES}경기 이상 선수만`;
  if (key === "smallReb" || key === "smallBlk") return `키 ${SMALL_MAX_CM}cm 이하, ${sample} 셉니다. ${base}`;
  if (key === "bigTp")
    return `키 ${BIG_MIN_CM}cm 이상, ${sample}${scope === "season" ? ", 3점 시도가 그 시즌 최다 경기 수의 60% 이상인 선수만" : `, 통산 3점 시도 ${PROFILE_CAREER_MIN_TPA}개 이상인 선수만`} 셉니다.`;
  return `같은 키 선수들 평균보다 경기당 리바운드를 몇 개 더 잡는지입니다. 국내 선수는 국내끼리, 외국인은 외국인끼리 비교해요. ${sample} 셉니다.`;
}
