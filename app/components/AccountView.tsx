"use client";
// 내 계정 화면 (/me, 2026-10-04): 로그인 전 = 구글·네이버 버튼, 로그인 뒤 = 닉네임·응원팀 정하기·즐겨찾기 개수·로그아웃·탈퇴.
// GA4: login_success{provider}(돌아온 직후) · profile_save{team_code} · favorites_sync{count} · logout · account_delete · login_error{reason}
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { signOut } from "next-auth/react";
import { enabledLoginProviders, NICKNAME_MAX, NICKNAME_MIN, PROVIDER_LABELS, validateNickname, type LoginProvider, type MemberView } from "@/lib/account";
import type { TeamColor } from "@/lib/types";
import { clearSuggestion, deleteAccount, fetchMe, forgetAccount, saveProfile, syncFavorites } from "./account-client";
import LoginButtons from "./LoginButtons";
import MemberBadge from "./MemberBadge";
import Skeleton from "./Skeleton";
import TeamLogo from "./TeamLogo";
import { trackEvent } from "./track";

export interface AccountTeam {
  teamCode: string;
  name: string;
  logoUrl: string | null;
  color: TeamColor;
}

type State = { kind: "loading" } | { kind: "signed_out" } | { kind: "error" } | { kind: "signed_in"; member: MemberView; suggested: string | null };

/** next-auth 가 /me?error=… 로 돌려보낸 이유 → 안내 문구 */
function loginErrorText(code: string): string {
  if (code === "AccessDenied" || code === "OAuthCallback") return "로그인을 마치지 못했어요. 동의 화면에서 취소했거나 시간이 지났을 수 있어요. 다시 해 주세요.";
  return "로그인 중 문제가 생겼어요. 잠시 뒤 다시 해 주세요.";
}

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <section className={`surface-card rounded-container p-4 ${className}`}>{children}</section>;
}

export default function AccountView({ teams }: { teams: AccountTeam[] }) {
  const providers = enabledLoginProviders();
  const [state, setState] = useState<State>({ kind: "loading" });
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (providers.length === 0) return;
    const q = new URLSearchParams(window.location.search);
    const justLoggedIn = q.get("login");
    const error = q.get("error");
    if (error) {
      setNotice(loginErrorText(error));
      trackEvent("login_error", { reason: error.slice(0, 40) });
    }
    if (q.get("deleted")) setNotice("탈퇴했어요. 계정 정보는 바로 지웠습니다.");
    if (justLoggedIn || error || q.get("deleted")) window.history.replaceState(null, "", "/me");
    void fetchMe(true).then(async (r) => {
      if (r.status === "signed_in") {
        if (justLoggedIn) trackEvent("login_success", { provider: justLoggedIn.slice(0, 10) });
        const count = await syncFavorites(r.member, !!justLoggedIn);
        if (justLoggedIn) trackEvent("favorites_sync", { count });
        const again = await fetchMe();
        setState({ kind: "signed_in", member: again.status === "signed_in" ? again.member : r.member, suggested: r.suggestedNickname ?? null });
      } else setState({ kind: r.status });
    });
    // providers 는 빌드 때 정해진 값이라 한 번만
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (providers.length === 0) {
    return (
      <Card>
        <h2 className="text-h2 font-bold">로그인 준비 중</h2>
        <p className="mt-2 text-body text-ink-2">구글·네이버 로그인을 준비하고 있어요. 지금은 즐겨찾기가 이 브라우저에만 저장됩니다.</p>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {notice && <p role="status" className="surface-card rounded-container px-4 py-3 text-body text-ink">{notice}</p>}
      {state.kind === "loading" && <Skeleton className="h-48 w-full rounded-container" />}
      {state.kind === "error" && (
        <Card>
          <p className="text-body text-ink-2">계정 정보를 불러오지 못했어요. 잠시 뒤 새로고침해 주세요.</p>
        </Card>
      )}
      {state.kind === "signed_out" && <SignedOut providers={providers} />}
      {state.kind === "signed_in" && (
        <SignedIn member={state.member} suggested={state.suggested} teams={teams} onChange={(member) => setState({ kind: "signed_in", member, suggested: null })} />
      )}
    </div>
  );
}

function SignedOut({ providers }: { providers: LoginProvider[] }) {
  return (
    <Card>
      <h2 className="text-h2 font-bold">로그인</h2>
      <ul className="mt-2 list-disc space-y-1 pl-5 text-body text-ink-2">
        <li>닉네임과 응원팀을 정하면 이름 옆에 팀 색 배지가 붙어요.</li>
        <li>즐겨찾기한 선수가 폰·PC 어디서 로그인해도 같이 보여요.</li>
      </ul>
      <div className="mt-4">
        <LoginButtons providers={providers} />
      </div>
      <p className="mt-3 text-sub text-ink-3">
        로그인 회사가 주는 고유 번호만 저장하고 이메일·이름·사진은 받지 않아요.{providers.includes("naver") ? " 네이버 별명은 처음 닉네임 칸에 미리 채우는 데만 써요." : ""}{" "}
        <Link href="/privacy" className="focus-ring rounded-md underline underline-offset-2">
          개인정보 처리 안내
        </Link>
      </p>
    </Card>
  );
}

function SignedIn({ member, suggested, teams, onChange }: { member: MemberView; suggested: string | null; teams: AccountTeam[]; onChange: (m: MemberView) => void }) {
  // 닉네임을 아직 안 정했으면 네이버 별명을 칸에 미리 채운다 (저장을 눌러야 저장)
  const fromNaver = !member.nickname && !!suggested;
  const [nickname, setNickname] = useState(member.nickname ?? suggested ?? "");
  const [teamCode, setTeamCode] = useState<string | null>(member.teamCode);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const team = useMemo(() => teams.find((t) => t.teamCode === teamCode) ?? null, [teams, teamCode]);
  const check = validateNickname(nickname);
  const changed = nickname.trim() !== (member.nickname ?? "") || teamCode !== member.teamCode;

  async function save() {
    if (!check.ok) return setMessage({ ok: false, text: check.error });
    setSaving(true);
    setMessage(null);
    const r = await saveProfile({ nickname: check.value, teamCode });
    setSaving(false);
    if (!r.ok) return setMessage({ ok: false, text: r.message });
    trackEvent("profile_save", { team_code: teamCode ?? "none" });
    if (fromNaver) void clearSuggestion();
    onChange(r.member);
    setMessage({ ok: true, text: "저장했어요." });
  }

  async function logout() {
    trackEvent("logout");
    forgetAccount();
    await signOut({ callbackUrl: "/me" });
  }

  async function remove() {
    const ok = await deleteAccount();
    if (!ok) return setMessage({ ok: false, text: "탈퇴하지 못했어요. 잠시 뒤 다시 해 주세요." });
    trackEvent("account_delete");
    await signOut({ callbackUrl: "/me?deleted=1" });
  }

  return (
    <>
      <Card>
        <p className="text-sub text-ink-3">{member.provider ? `${PROVIDER_LABELS[member.provider]} 계정으로 로그인됨` : "로그인됨"}</p>
        <div className="mt-1 text-h2">
          {member.nickname ? <MemberBadge nickname={member.nickname} teamColor={teams.find((t) => t.teamCode === member.teamCode)?.color} /> : <span className="font-bold">닉네임을 정해 주세요</span>}
        </div>

        <label className="mt-4 block text-sub font-semibold text-ink-2" htmlFor="nickname">
          닉네임 <span className="font-normal text-ink-3">({NICKNAME_MIN}~{NICKNAME_MAX}자, 한글·영문·숫자·_)</span>
        </label>
        <input
          id="nickname"
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
          maxLength={NICKNAME_MAX + 4}
          autoComplete="off"
          className="focus-ring mt-1 h-11 w-full rounded-control border border-line bg-surface px-3 text-base text-ink"
          aria-invalid={nickname !== "" && !check.ok}
          aria-describedby="nickname-help"
        />
        <p id="nickname-help" className="mt-1 min-h-5 text-sub text-ink-3">
          {nickname !== "" && !check.ok ? check.error : fromNaver && nickname === suggested ? "네이버 별명을 미리 넣어 두었어요. 바꿔서 저장해도 돼요." : ""}
        </p>

        <p className="mt-3 text-sub font-semibold text-ink-2">응원팀</p>
        <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
          {teams.map((t) => {
            const on = t.teamCode === teamCode;
            return (
              <button
                key={t.teamCode}
                type="button"
                aria-pressed={on}
                onClick={() => setTeamCode(on ? null : t.teamCode)}
                className={`focus-ring flex h-11 min-w-0 cursor-pointer items-center gap-2 rounded-control border px-2 text-sub font-semibold transition-colors duration-200 ${
                  on ? "border-ink bg-surface-2 text-ink" : "border-line bg-surface text-ink-2 hover:bg-surface-2"
                }`}
              >
                <TeamLogo logoUrl={t.logoUrl} shortName={t.name} color={t.color} size={24} />
                <span className="truncate">{t.name}</span>
              </button>
            );
          })}
        </div>
        <p className="mt-2 text-sub text-ink-3">{team ? `${team.name} 팬으로 표시돼요. 한 번 더 누르면 해제.` : "응원팀 없이도 쓸 수 있어요."}</p>

        <button
          type="button"
          onClick={save}
          disabled={saving || !changed}
          className="focus-ring mt-4 h-11 w-full cursor-pointer rounded-control bg-ink text-body font-bold text-bg transition-colors duration-200 disabled:cursor-default disabled:bg-surface-2 disabled:text-ink-3"
        >
          {saving ? "저장 중…" : "저장"}
        </button>
        {message && (
          <p role="status" className={`mt-2 text-sub ${message.ok ? "text-ink-2" : "font-semibold text-ink"}`}>
            {message.text}
          </p>
        )}
      </Card>

      <Card>
        <h2 className="text-body font-bold">즐겨찾기</h2>
        <p className="mt-1 text-body text-ink-2">
          {member.favorites.length > 0 ? `선수 ${member.favorites.length}명이 계정에 저장돼 있어요. 다른 기기에서 로그인해도 같이 보여요.` : "선수 페이지의 별 버튼을 누르면 계정에 저장돼요."}
        </p>
        {member.favorites.length > 0 && (
          <Link href="/" className="focus-ring mt-2 inline-flex h-10 items-center rounded-control text-sub font-semibold text-ink underline underline-offset-2">
            홈에서 보기
          </Link>
        )}
      </Card>

      <Card>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={logout}
            className="focus-ring h-11 cursor-pointer rounded-control border border-line bg-surface px-4 text-body font-semibold text-ink transition-colors duration-200 hover:bg-surface-2"
          >
            로그아웃
          </button>
          {!confirmDelete ? (
            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              className="focus-ring h-11 cursor-pointer rounded-control px-4 text-body font-semibold text-ink-3 transition-colors duration-200 hover:text-ink"
            >
              회원 탈퇴
            </button>
          ) : (
            <div className="w-full rounded-card border border-line p-3">
              <p className="text-body text-ink">탈퇴하면 닉네임·응원팀·계정의 즐겨찾기가 바로 지워지고 되돌릴 수 없어요. 이 브라우저의 즐겨찾기는 남아요.</p>
              <div className="mt-2 flex gap-2">
                <button
                  type="button"
                  onClick={remove}
                  className="focus-ring h-11 cursor-pointer rounded-control bg-ink px-4 text-body font-bold text-bg transition-colors duration-200"
                >
                  탈퇴하기
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmDelete(false)}
                  className="focus-ring h-11 cursor-pointer rounded-control border border-line bg-surface px-4 text-body font-semibold text-ink transition-colors duration-200 hover:bg-surface-2"
                >
                  취소
                </button>
              </div>
            </div>
          )}
        </div>
      </Card>
    </>
  );
}
