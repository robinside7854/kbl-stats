// 하프코트 그림 + 주전 다섯 자리 (54-0 결과·팀 올타임 베스트 5 공용, 2026-10-16 GameView 에서 옮김).
// 자리 순서 = lib/game GAME_SLOTS (가드·가드·포워드·포워드·센터).

/**
 * 코트 위 자리 (가로·세로 %, 바스켓은 아래 가운데). 값은 상자 안 사진 가운데 위치(이름표는 사진 아래로 붙는다).
 * 좌우 대칭: 탑 1 · 윙 2 · 로우 2. 폰은 상자를 코트보다 조금 길게(15:16) 두고 남는 아래쪽(엔드라인 밖)을 로우 선수 이름표 자리로 쓴다
 */
export const COURT_SPOTS: readonly { x: number; y: number }[] = [
  { x: 50, y: 11 }, // 가드: 탑
  { x: 20, y: 32 }, // 가드: 왼쪽 윙
  { x: 80, y: 32 }, // 포워드: 오른쪽 윙
  { x: 24, y: 71 }, // 포워드: 왼쪽 로우
  { x: 76, y: 71 }, // 센터: 오른쪽 로우(골밑)
];

/** FIBA 하프코트 15m × 14m. 미터 단위 viewBox, 바스켓이 아래 */
export function CourtLines() {
  const W = 15;
  const H = 14;
  const rimY = H - 1.575;
  // 3점: 바스켓에서 6.75m 호 + 사이드 0.9m 안쪽 직선 (직선이 호와 만나는 높이)
  const cx = W / 2;
  const sideX = 0.9;
  const dy = Math.sqrt(6.75 ** 2 - (cx - sideX) ** 2);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="absolute inset-0 h-full w-full" preserveAspectRatio="xMidYMin meet" aria-hidden>
      <g fill="none" stroke="var(--ink-3)" strokeWidth={0.06}>
        <rect x={0.03} y={0.03} width={W - 0.06} height={H - 0.06} />
        {/* 페인트 4.9 × 5.8, 자유투 원 r1.8 */}
        <rect x={cx - 2.45} y={H - 5.8} width={4.9} height={5.8} />
        <circle cx={cx} cy={H - 5.8} r={1.8} />
        {/* 3점 라인 */}
        <path d={`M ${sideX} ${H} L ${sideX} ${rimY - dy} A 6.75 6.75 0 0 1 ${W - sideX} ${rimY - dy} L ${W - sideX} ${H}`} />
        {/* 백보드·림 */}
        <line x1={cx - 0.9} y1={H - 1.2} x2={cx + 0.9} y2={H - 1.2} strokeWidth={0.1} />
        <circle cx={cx} cy={rimY} r={0.225} />
        {/* 하프라인 쪽 센터 원 반쪽 */}
        <path d={`M ${cx - 1.8} 0 A 1.8 1.8 0 0 0 ${cx + 1.8} 0`} />
      </g>
    </svg>
  );
}
