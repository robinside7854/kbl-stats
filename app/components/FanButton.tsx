"use client";
// 응원하기 버튼 (2026-10-05 팀 팬 수): 팀 페이지 머리말. "응원하기 · 팬 N명" — 누르면 내 응원팀에 더하거나 뺀다(/api/me PATCH teamCodes).
// 팬 수 = 응원팀으로 고른 회원 수(/api/likes fans, 1분 기억). 로그인 안 했으면 로그인 안내, 로그인이 꺼진 빌드면 안 그린다.
// GA4: fan_add / fan_remove { team_code }
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { adjustedCount, enabledLoginProviders, MAX_TEAMS } from "@/lib/account";
import { saveProfile } from "./account-client";
import { IconMegaphone } from "./icons";
import { trackEvent } from "./track";
import { useLikeCounts, useMember } from "./useLikes";

export default function FanButton({ teamCode, label }: { teamCode: string; label: string }) {
  const counts = useLikeCounts();
  const member = useMember();
  const fanOnServer = useRef<boolean | null>(null);
  const [fan, setFan] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [askLogin, setAskLogin] = useState(false);

  useEffect(() => {
    if (member === undefined) return;
    const on = member?.teamCodes.includes(teamCode) ?? false;
    if (fanOnServer.current === null) fanOnServer.current = on;
    setFan(on);
  }, [member, teamCode]);

  if (enabledLoginProviders().length === 0) return null;
  const count = counts ? adjustedCount(counts.fans?.[teamCode] ?? 0, fanOnServer.current ?? false, fan) : null;

  async function click() {
    setNotice(null);
    if (!member) {
      setAskLogin((v) => !v);
      return;
    }
    const next = !fan;
    const current = member.teamCodes;
    if (next && current.length >= MAX_TEAMS) {
      setNotice(`응원팀은 ${MAX_TEAMS}팀까지 고를 수 있어요.`);
      return;
    }
    setFan(next);
    setBusy(true);
    const r = await saveProfile({ teamCodes: next ? [...current, teamCode] : current.filter((c) => c !== teamCode) });
    setBusy(false);
    if (!r.ok) {
      setFan(!next);
      setNotice(r.message);
      return;
    }
    trackEvent(next ? "fan_add" : "fan_remove", { team_code: teamCode });
  }

  return (
    <span className="relative inline-flex">
      <button
        type="button"
        onClick={click}
        disabled={busy}
        aria-pressed={fan}
        aria-label={`${label} 응원하기${count !== null ? `, 팬 ${count}명` : ""}`}
        className={`focus-ring inline-flex h-10 shrink-0 cursor-pointer items-center gap-1.5 rounded-control px-3 text-sub font-bold transition-colors duration-200 disabled:cursor-wait ${
          fan ? "bg-white text-[#0b0b0b] hover:bg-white/85" : "bg-black/25 hover:bg-black/40"
        }`}
      >
        <IconMegaphone size={16} filled={fan} />
        {fan ? "응원 중" : "응원하기"}
        {count !== null && <span className="tabular font-semibold opacity-80">· 팬 {count.toLocaleString("ko-KR")}명</span>}
      </button>
      {(askLogin || notice) && (
        <span role="status" className="surface-card absolute left-0 top-full z-20 mt-1 w-56 rounded-card p-3 text-sub font-normal text-ink">
          {notice ?? (
            <>
              로그인하면 응원팀으로 정할 수 있어요.{" "}
              <Link href="/me" className="focus-ring rounded-md font-semibold underline underline-offset-2">
                로그인하기
              </Link>
            </>
          )}
        </span>
      )}
    </span>
  );
}
