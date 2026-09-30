// 불러오는 중 자리 표시 (디자인 점검 C3). 실제 레이아웃과 같은 모양·크기의 회색 면을 깔아 내용이 들어올 때 화면이 튀지 않게 한다.
// 펄스는 prefers-reduced-motion 이면 끈다(motion-reduce). 장식이라 aria-hidden — 상태 문구는 부르는 쪽이 role="status" 로.
export default function Skeleton({ className = "", style }: { className?: string; style?: React.CSSProperties }) {
  // 반경을 따로 주지 않으면 칩 반경(8px)
  const radius = /\brounded-/.test(className) ? "" : "rounded-control";
  // deslop-ignore-next-line 16
  return <span aria-hidden className={`block animate-pulse bg-surface-2 motion-reduce:animate-none ${radius} ${className}`} style={style} />;
}
