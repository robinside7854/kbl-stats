// Neon(Postgres) 연결 — 서버 전용. 접속 주소는 Vercel 의 Neon 연동이 넣어 주는 환경변수 DATABASE_URL.
// 없으면 null (로그인 기능이 꺼진 상태). 표 만들기는 한 서버 인스턴스에서 한 번만.
import "server-only";
import { neon } from "@neondatabase/serverless";
import { ensureSchema, type Query } from "./members";

let cached: Query | null = null;
let schemaReady: Promise<void> | null = null;

export function databaseUrl(): string {
  return process.env.DATABASE_URL ?? process.env.POSTGRES_URL ?? "";
}

/** 표가 준비된 Query (DB 설정이 없으면 null) */
export async function getDb(): Promise<Query | null> {
  const url = databaseUrl();
  if (!url) return null;
  if (!cached) {
    const sql = neon(url);
    cached = (text, params) => sql.query(text, params ?? []) as Promise<Record<string, unknown>[]>;
  }
  if (!schemaReady) schemaReady = ensureSchema(cached).catch((e) => {
    schemaReady = null; // 다음 요청 때 다시
    throw e;
  });
  await schemaReady;
  return cached;
}
