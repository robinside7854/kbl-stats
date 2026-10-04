// 닉네임 + 응원팀 배지 (헤더·내 계정 화면). 팀 색 점 + 닉네임 — 나중에 댓글 이름표에도 같은 모양을 쓴다.
import type { TeamColor } from "@/lib/types";

export default function MemberBadge({ nickname, teamColor, teamName }: { nickname: string; teamColor?: TeamColor | null; teamName?: string | null }) {
  return (
    <span className="inline-flex min-w-0 items-center gap-1.5">
      {teamColor && (
        <span
          aria-hidden
          // deslop-ignore-next-line 19
          className="h-2.5 w-2.5 shrink-0 rounded-full ring-1 ring-inset ring-black/10 dark:ring-white/30"
          style={{ backgroundColor: teamColor.primary }}
        />
      )}
      <span className="truncate font-bold">{nickname}</span>
      {teamName && <span className="sr-only">({teamName} 응원)</span>}
    </span>
  );
}
