// ⓘ 아이콘 — 누르면 그 자리에서 용어 설명 팝오버(HelpPopover)가 뜬다 (2026-09-30 피드백 5차: 용어 탭을 메뉴에서 뺐다).
// 예전에는 용어 탭(/glossary#앵커)으로 이동하는 링크였다. 이제 이동은 팝오버 안 "자세히"를 누를 때만.
// 부르는 쪽 API(term·compact·className)는 그대로 — 순위표·기록표·비교표·팀 분포·카드가 이 컴포넌트를 쓴다.
// 누르는 영역은 40×40(C1), 음수 여백으로 글줄 높이·간격은 아이콘(16px) 크기만큼만 차지한다. compact: 표 머리글용 40×20.
import type { GlossaryKey } from "@/lib/glossary";
import HelpPopover from "./HelpPopover";

export default function InfoLink({ term, className = "", compact = false }: { term: GlossaryKey; className?: string; compact?: boolean }) {
  return <HelpPopover term={term} compact={compact} className={className} />;
}
