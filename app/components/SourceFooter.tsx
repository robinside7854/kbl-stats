// 모든 화면 하단 고정 출처 표기 (CLAUDE.md 원칙 6)
export const SOURCE_LINE = "기록 출처: KBL 공식 홈페이지 · 비영리 팬 프로젝트";

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
      {fetchedAt && <p className="mt-1">데이터 수집일: {formatFetchedAt(fetchedAt)}</p>}
    </footer>
  );
}
