// 모든 화면 하단 고정 출처 표기 (CLAUDE.md 원칙 6)
import { officialImagesEnabled } from "@/lib/images";

export const SOURCE_LINE = "기록 출처: KBL 공식 홈페이지 · 비영리 팬 프로젝트";
// 공식 사진·로고를 쓸 때만 붙는 줄 (PLAN.md §5-2 ⑤). 스위치가 off면 사진·로고가 없으므로 숨긴다
export const IMAGE_CREDIT_LINE = "사진·로고 © KBL 및 각 구단 · 비영리 팬 프로젝트, 요청 시 즉시 삭제";

export function formatFetchedAt(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  // 한국 시간 기준 날짜
  return new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", dateStyle: "medium" }).format(d);
}

export default function SourceFooter({ fetchedAt }: { fetchedAt?: string }) {
  return (
    <footer className="mx-auto mt-10 max-w-3xl border-t border-line px-4 py-6 text-xs text-ink-3">
      <p>{SOURCE_LINE}</p>
      {officialImagesEnabled() && <p className="mt-1">{IMAGE_CREDIT_LINE}</p>}
      {fetchedAt && <p className="mt-1">데이터 수집일: {formatFetchedAt(fetchedAt)}</p>}
    </footer>
  );
}
