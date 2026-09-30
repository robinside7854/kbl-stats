// 선수 상세 하이라이트 카드 3개 (피드백 3차 #6): 그 시즌 순위 1~10위 부문(lib/cardview seasonHighlights),
// 없으면 정규시즌 커리어 하이(careerHighlights). 계산은 lib/cardview — 여기서는 그리기만 한다.
// 데이터 숫자는 tabular, 1위만 팀 색 옅은 바탕(순위 칸과 같은 --rank-tint 규칙).
import type { Highlight } from "@/lib/cardview";
import { desaturate } from "@/lib/teams";

interface Props {
  title: string;
  items: Highlight[];
  teamPrimary: string;
}

export default function HighlightCards({ title, items, teamPrimary }: Props) {
  if (items.length === 0) return null;
  const tint = desaturate(teamPrimary, 0.2);
  return (
    <section aria-labelledby="highlight-title">
      <h3 id="highlight-title" className="mb-2 text-body font-bold text-ink">
        {title}
      </h3>
      <ul className="tabular grid grid-cols-3 gap-2">
        {items.map((h) => (
          <li
            key={h.key}
            className="surface-card flex min-w-0 flex-col rounded-card px-3 py-2.5"
            style={
              h.rank === 1
                ? {
                    background: `color-mix(in srgb, ${tint} var(--rank-tint), var(--surface))`,
                    borderColor: `color-mix(in srgb, ${tint} var(--rank-border), var(--surface))`,
                  }
                : undefined
            }
          >
            <span className="text-sub font-semibold text-ink-2 [overflow-wrap:anywhere]">{h.title}</span>
            <span className="mt-1 text-h2 font-bold tracking-tight text-ink">
              {h.value}
              <span className="ml-1 text-caption font-medium text-ink-3">{h.unit}</span>
            </span>
            {h.note && <span className="mt-0.5 text-caption text-ink-3 [overflow-wrap:anywhere]">{h.note}</span>}
          </li>
        ))}
      </ul>
    </section>
  );
}
