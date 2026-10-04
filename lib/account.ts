// 회원(구글·네이버 로그인) 규칙 — 순수 함수만 (2026-10-04 사용자 결정: 커뮤니티 2단계 시작).
// 범위: 닉네임·응원팀 배지 + 즐겨찾기 계정 저장. 개인정보는 최소 — 로그인 회사가 주는 고유 번호만 쓰고
// 이메일·실명·프로필 사진은 받지도 저장하지도 않는다. 닉네임은 본인이 직접 입력(네이버는 별명을 칸에 미리 채워 주기만 — 2026-10-04, lib/server/auth suggest).
// 서버 저장(Neon)은 lib/server/members.ts, 로그인 설정은 lib/server/auth.ts, 브라우저 쪽은 app/components/account-client.ts.

export const LOGIN_PROVIDERS = ["google", "naver"] as const;
export type LoginProvider = (typeof LOGIN_PROVIDERS)[number];

export const PROVIDER_LABELS: Record<LoginProvider, string> = { google: "구글", naver: "네이버" };

/**
 * 켜진 로그인 회사 목록 — next.config.mjs 가 빌드 때 NEXT_PUBLIC_LOGIN_PROVIDERS 로 넣는다
 * (운영 배포 + 비밀값·DB·그 회사 키가 모두 있을 때만). 비어 있으면 로그인 화면·버튼을 감춘다.
 */
export function parseLoginProviders(raw: string | undefined | null): LoginProvider[] {
  if (!raw) return [];
  const out: LoginProvider[] = [];
  for (const p of raw.split(",")) {
    const v = p.trim() as LoginProvider;
    if ((LOGIN_PROVIDERS as readonly string[]).includes(v) && !out.includes(v)) out.push(v);
  }
  return out;
}

export function enabledLoginProviders(): LoginProvider[] {
  return parseLoginProviders(process.env.NEXT_PUBLIC_LOGIN_PROVIDERS);
}

/** 회원 번호 = "로그인 회사:그 회사가 준 고유 번호" (예: "google:1234", "naver:AbC") */
export function memberIdOf(provider: string, accountId: string): string | null {
  if (!(LOGIN_PROVIDERS as readonly string[]).includes(provider)) return null;
  const id = String(accountId ?? "").trim();
  if (!id || id.length > 200) return null;
  return `${provider}:${id}`;
}

export function providerOfMemberId(memberId: string): LoginProvider | null {
  const p = memberId.split(":")[0];
  return (LOGIN_PROVIDERS as readonly string[]).includes(p) ? (p as LoginProvider) : null;
}

// ── 닉네임 ─────────────────────────────────────────────
export const NICKNAME_MIN = 2;
export const NICKNAME_MAX = 12;
/** 운영자·공식으로 오해할 수 있는 말 (대소문자 무시, 포함되면 거절) */
const NICKNAME_BLOCKED = ["운영자", "관리자", "운영진", "admin", "kbl", "공식", "official", "스탯레퍼런스"];

export type NicknameCheck = { ok: true; value: string } | { ok: false; error: string };

/** 한글(완성형)·영문·숫자·밑줄만, 2~12자. 공백은 앞뒤만 지운다(가운데 공백은 거절) */
export function validateNickname(raw: unknown): NicknameCheck {
  if (typeof raw !== "string") return { ok: false, error: "닉네임을 입력해 주세요." };
  const value = raw.normalize("NFC").trim();
  if (value.length < NICKNAME_MIN || value.length > NICKNAME_MAX) {
    return { ok: false, error: `닉네임은 ${NICKNAME_MIN}~${NICKNAME_MAX}자로 정해 주세요.` };
  }
  if (!/^[가-힣a-zA-Z0-9_]+$/.test(value)) return { ok: false, error: "한글·영문·숫자·밑줄(_)만 쓸 수 있어요." };
  const lower = value.toLowerCase();
  if (NICKNAME_BLOCKED.some((w) => lower.includes(w))) return { ok: false, error: "운영자나 공식 계정으로 오해할 수 있는 이름은 쓸 수 없어요." };
  return { ok: true, value };
}

/** 응원팀 = 팀 코드(숫자 1~3자리) 또는 없음 */
export function normalizeTeamCode(raw: unknown): string | null | undefined {
  if (raw === null || raw === "") return null;
  if (typeof raw !== "string" || !/^\d{1,3}$/.test(raw)) return undefined; // undefined = 잘못된 값
  return raw;
}

// ── 즐겨찾기 ───────────────────────────────────────────
/** 계정 하나에 저장하는 즐겨찾기 상한 (선수 전체가 약 1,300명) */
export const MAX_FAVORITES = 300;

/** 숫자 선수 번호만, 중복 제거, 상한까지 */
export function sanitizeFavorites(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  for (const x of raw) {
    if (typeof x === "string" && /^\d{1,10}$/.test(x) && !out.includes(x)) out.push(x);
    if (out.length >= MAX_FAVORITES) break;
  }
  return out;
}

/** 이 브라우저 목록 + 계정 목록 합치기: 이 브라우저 순서를 먼저, 계정에만 있던 선수는 뒤에 */
export function mergeFavorites(local: readonly string[], server: readonly string[]): string[] {
  return sanitizeFavorites([...local, ...server]);
}

export function sameList(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((x, i) => x === b[i]);
}

// ── 계정 연결 (2026-10-04 사용자 결정: 구글·네이버를 한 회원으로) ──────────
// 회원 하나에 로그인 수단(로그인 번호)이 여러 개 붙는다 — 회사마다 하나씩. 이메일을 받지 않으므로 자동으로 합치지 않고,
// 로그인한 회원이 "연결하기"로 다른 회사 로그인을 한 번 거쳐야 붙는다. 이미 따로 가입한 계정이면 합친다(lib/server/members linkLogin).

/** 연결 결과 (로그인 쿠키에 잠시 실려 /me 가 안내한 뒤 지운다) */
export type LinkResult = "linked" | "merged" | "conflict" | "failed";
export const LINK_RESULTS: readonly LinkResult[] = ["linked", "merged", "conflict", "failed"];

export function linkResultMessage(result: LinkResult, provider: LoginProvider | null): string {
  const name = provider ? PROVIDER_LABELS[provider] : "다른";
  switch (result) {
    case "linked":
      return `${name} 계정을 연결했어요. 이제 어느 쪽으로 로그인해도 같은 계정이에요.`;
    case "merged":
      return `${name}로 따로 만든 계정을 이 계정에 합쳤어요. 즐겨찾기는 합치고, 닉네임·응원팀은 이 계정 것을 남겼어요.`;
    case "conflict":
      return `그 ${name} 계정은 이미 다른 회원 계정에 쓰이고 있고, 두 계정에 같은 회사 로그인이 겹쳐서 합칠 수 없어요.`;
    default:
      return "연결하지 못했어요. 잠시 뒤 다시 해 주세요.";
  }
}

/** 연결 해제 가능 여부: 로그인 수단이 하나만 남으면 안 되고, 지금 로그인한 수단은 풀 수 없다 */
export function canUnlink(logins: readonly LoginProvider[], current: LoginProvider | null, target: LoginProvider): boolean {
  return logins.includes(target) && logins.length > 1 && current !== target;
}

// ── 관리자 ─────────────────────────────────────────────
// 관리자 = 환경변수 ADMIN_LOGIN_IDS 에 적은 로그인 번호("google:…","naver:…", 쉼표로) 중 하나가 붙은 회원.
// 이메일로 정하지 않는 이유: 개인정보 최소 원칙으로 로그인 회사에서 이메일을 받지 않는다. 번호는 /admin 이 본인에게 보여 준다.
export function parseAdminLoginIds(raw: string | undefined | null): Set<string> {
  const out = new Set<string>();
  for (const p of (raw ?? "").split(",")) {
    const v = p.trim();
    if (providerOfMemberId(v) && v.length > v.indexOf(":") + 1) out.add(v);
  }
  return out;
}

export function isAdminLogin(loginIds: readonly string[], admins: ReadonlySet<string>): boolean {
  return loginIds.some((id) => admins.has(id));
}

// ── 화면에 보내는 회원 정보 ─────────────────────────────
export interface MemberView {
  /** 지금 로그인한 수단 */
  provider: LoginProvider | null;
  nickname: string | null;
  teamCode: string | null;
  favorites: string[];
  /** 이 회원에 연결된 로그인 수단 (회사 순서) */
  logins: LoginProvider[];
  isAdmin?: boolean;
}

/** 관리자 화면 회원 한 줄 */
export interface AdminMemberRow {
  /** 회원 번호 끝 6자리 (문의 대응용 짧은 표시) */
  shortId: string;
  nickname: string | null;
  teamCode: string | null;
  favoriteCount: number;
  logins: LoginProvider[];
  createdAt: string;
  updatedAt: string;
}
