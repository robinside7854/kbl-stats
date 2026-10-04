"use client";
// 좋아요 상태 (2026-10-04): 공개 수(/api/likes, 1분 기억) + 내 좋아요(로그인한 브라우저만 /api/me 기억값).
// 로그인이 꺼진 빌드면 아무것도 부르지 않는다 (enabled false).
import { useEffect, useState } from "react";
import { enabledLoginProviders, type LikeCounts, type MemberView } from "@/lib/account";
import { ACCOUNT_EVENT, cachedMember, fetchLikeCounts, fetchMe, hasSignedInHint } from "./account-client";

export function useLikeCounts(): LikeCounts | null {
  const [counts, setCounts] = useState<LikeCounts | null>(null);
  useEffect(() => {
    if (enabledLoginProviders().length === 0) return;
    let alive = true;
    void fetchLikeCounts().then((c) => alive && setCounts(c));
    return () => {
      alive = false;
    };
  }, []);
  return counts;
}

/** 로그인한 회원 (없으면 null, 확인 중이면 undefined) */
export function useMember(): MemberView | null | undefined {
  const [member, setMember] = useState<MemberView | null | undefined>(undefined);
  useEffect(() => {
    if (enabledLoginProviders().length === 0 || !hasSignedInHint()) {
      setMember(null);
      return;
    }
    const refresh = () => setMember(hasSignedInHint() ? cachedMember() : null);
    const c = cachedMember();
    if (c) setMember(c);
    else void fetchMe().then((r) => setMember(r.status === "signed_in" ? r.member : null));
    window.addEventListener(ACCOUNT_EVENT, refresh);
    return () => window.removeEventListener(ACCOUNT_EVENT, refresh);
  }, []);
  return member;
}
