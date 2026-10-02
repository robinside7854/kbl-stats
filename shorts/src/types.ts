// 렌더 입력(props.json) 형식 — scripts/build-short.ts + scripts/prepare-short.ts 가 만든다

export type SourceKey = "paint" | "mid" | "three" | "ft";

export interface ScoringSource {
  key: SourceKey;
  label: string;
  points: number;
  perGame: number;
  share: number;
}

export interface EpisodePlayer {
  rank: number;
  playerNo: string;
  name: string;
  nameEn: string;
  position: string | null;
  backNumber: string | null;
  team: { code: string; name: string; color: string; secondary: string; logoFile: string | null };
  photoFile: string | null;
  ppg: number;
  games: number;
  mpg: number;
  tpPct: number;
  ftPct: number;
  sources: ScoringSource[];
  callout: { kind: string; source: SourceKey | null; headline: string; note: string };
  offenseType: string | null;
  shots: { missed: [number, number, number][]; made: [number, number, number][]; total: number };
}

export interface EpisodeScene {
  id: string;
  kind: "cover" | "player" | "compare" | "outro";
  playerNo?: string;
  caption: string;
  chunks: string[];
  audio: string | null;
  seconds: number;
  /** 자막 조각별 시작 시각(장면 기준 초) — 한 번에 읽힌 내레이션(ElevenLabs)일 때만 */
  chunkStarts?: number[] | null;
}

export interface EpisodeProps {
  slug: string;
  seasonLabel: string;
  court: { viewBox: string; lines: string[]; rim: { cx: number; cy: number; r: number } };
  players: EpisodePlayer[];
  scenes: EpisodeScene[];
  /** 전체 내레이션 한 파일 (있으면 장면별 audio 대신) */
  narration?: string | null;
  /** 배경음악 (shorts/public 기준 경로) */
  bgm?: string | null;
  [key: string]: unknown;
}
