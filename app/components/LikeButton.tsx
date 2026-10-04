"use client";
// 좋아요 버튼 (2026-10-04): 선수 상세 머리말·팀 페이지. 하트 + 좋아요 수(모든 회원 합).
// 로그인 안 했으면 누를 때 로그인 안내를 띄운다. 로그인이 꺼진 빌드면 아무것도 안 그린다.
// GA4: like_add / like_remove { kind, player_no | team_code }
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { adjustedCount, enabledLoginProviders, type LikeKind } from "@/lib/account";
import { saveLike } from "./account-client";
import { IconHeart } from "./icons";
import { trackEvent } from "./track";
import { useLikeCounts, useMember } from "./useLikes";

export default function LikeButton({ kind, target, label, tone = "onColor", compact = false, className = "" }: {
  kind: LikeKind;
  target: string;
  /** 읽기용 이름 (예: "자밀 워니", "서울 SK") */
  label: string;
  /** onColor = 팀 색 머리말 위, plain = 흰 면 위 */
  tone?: "onColor" | "plain";
  /** 폰에서 "좋아요" 글자를 숨기고 하트 + 수만 (좁은 머리말) */
  compact?: boolean;
  className?: string;
}) {
  const counts = useLikeCounts();
  const member = useMember();
  const list = (m: typeof member) => (kind === "player" ? m?.likes?.players : m?.likes?.teams) ?? [];
  const likedOnServer = useRef<boolean | null>(null);
  const [liked, setLiked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [askLogin, setAskLogin] = useState(false);

  useEffect(() => {
    if (member === undefined) return;
    const on = list(member).includes(target);
    if (likedOnServer.current === null) likedOnServer.current = on;
    setLiked(on);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [member, target]);

  if (enabledLoginProviders().length === 0) return null;
  const server = (kind === "player" ? counts?.players[target] : counts?.teams[target]) ?? 0;
  const count = counts ? adjustedCount(server, likedOnServer.current ?? false, liked) : null;

  async function click() {
    setNotice(null);
    if (!member) {
      setAskLogin((v) => !v);
      return;
    }
    const next = !liked;
    setLiked(next);
    setBusy(true);
    const r = await saveLike(kind, target, next);
    setBusy(false);
    if (!r.ok) {
      setLiked(!next);
      setNotice(r.message);
      return;
    }
    trackEvent(next ? "like_add" : "like_remove", kind === "player" ? { kind, player_no: target } : { kind, team_code: target });
  }

  const base =
    tone === "onColor"
      ? liked
        ? "bg-white text-[#0b0b0b] hover:bg-white/85"
        : "bg-black/25 hover:bg-black/40"
      : liked
        ? "border border-ink bg-ink text-bg"
        : "border border-line bg-surface text-ink hover:bg-surface-2";

  return (
    <span className={`relative inline-flex ${className}`}>
      <button
        type="button"
        onClick={click}
        disabled={busy}
        aria-pressed={liked}
        aria-label={`${label} 좋아요${count !== null ? ` ${count}명` : ""}`}
        className={`focus-ring inline-flex h-10 shrink-0 cursor-pointer items-center gap-1.5 rounded-control px-3 text-sub font-bold transition-colors duration-200 disabled:cursor-wait ${base}`}
      >
        <IconHeart size={16} filled={liked} />
        <span className={compact ? "sr-only sm:not-sr-only" : undefined}>좋아요</span>
        {count !== null && <span className="tabular">{count.toLocaleString("ko-KR")}</span>}
      </button>
      {(askLogin || notice) && (
        <span
          role="status"
          className="surface-card absolute left-0 top-full z-20 mt-1 w-56 rounded-card p-3 text-sub font-normal text-ink"
        >
          {notice ?? (
            <>
              로그인하면 좋아요를 누를 수 있어요.{" "}
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
