"use client";
// 선수 원형 아바타: 기본은 팀 색 + 이름 첫 글자, 공식 사진이 있으면 위에 얹는다 (PLAN.md §5-2 ③).
// next/image를 쓰지 않는다 — 외부 사진을 Vercel이 다시 받아 최적화(=복제)하지 않도록 브라우저가 직접 받게 둔다.
// ⚠️ 이미지 저장(html-to-image) 대상 영역 안에는 넣지 않는다 — KBL 서버에 CORS 헤더가 없어 저장이 실패한다.
import type { TeamColor } from "@/lib/types";
import { nameInitial } from "@/lib/images";
import { useOfficialImage } from "./useOfficialImage";

const FALLBACK: TeamColor = { primary: "#6B7280", secondary: "#9CA3AF", text: "#fff" };

interface Props {
  photoUrl?: string | null;
  nameKo: string;
  color?: TeamColor;
  size?: number;
  className?: string;
}

export default function PlayerAvatar({ photoUrl, nameKo, color = FALLBACK, size = 32, className = "" }: Props) {
  const { src, imgProps } = useOfficialImage(photoUrl);
  return (
    <span
      className={`relative inline-flex shrink-0 select-none items-center justify-center overflow-hidden rounded-full font-bold ${className}`}
      style={{ width: size, height: size, background: color.primary, color: color.text, fontSize: Math.round(size * 0.45) }}
      title={nameKo}
    >
      <span aria-hidden={!!src}>{nameInitial(nameKo)}</span>
      {src && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          {...imgProps}
          src={src}
          alt={nameKo}
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          width={size}
          height={size}
          className="absolute inset-0 h-full w-full object-cover object-top"
        />
      )}
    </span>
  );
}
