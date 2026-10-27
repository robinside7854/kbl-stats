// GA4 방문 통계 조회 (2026-10-27 — 사용자: "실제 방문 통계를 보고 어디를 강화할지")
//
// 무엇을: GA4 Data API(runReport)로 요약·일별·화면·이벤트·유입·기기 보고서를 받아 표로 찍는다. 읽기 전용.
// 열쇠: 서비스 계정(구글 클라우드 kbl-stats-reference 프로젝트, GA4 속성 "뷰어")의 값 세 개를 환경 변수로 받는다.
//   GA4_PROPERTY_ID  속성 ID(숫자, G- 측정 ID 아님)
//   GA4_CLIENT_EMAIL 서비스 계정 메일
//   GA4_PRIVATE_KEY  JSON 키 파일의 private_key 값 (줄바꿈이 "\n" 글자로 들어와도 됨)
//   값은 Claude 클라우드 환경 설정(환경 변수)에만 — 코드·커밋·대화창에 넣지 않는다. 없으면 무엇이 없는지만 말하고 끝.
// 실행: npm run ga4 -- [--since 2026-10-02] [--until today] [--only summary,pages,events,sources,devices,daily]
//       npm run ga4 -- --event nav_click --param menu   (맞춤 정의로 등록한 이벤트 매개변수별 횟수)
// API: https://developers.google.com/analytics/devguides/reporting/data/v1/rest/v1beta/properties/runReport
//      토큰은 서비스 계정 JWT → https://oauth2.googleapis.com/token (Node 기본 crypto 로 서명, 의존성 없음)

import { createSign } from "node:crypto";

const SCOPE = "https://www.googleapis.com/auth/analytics.readonly";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
/** GA4 를 사이트에 단 날 (CLAUDE.md 2026-10-02) — 기본 시작일 */
const DEFAULT_SINCE = "2026-10-02";

interface Args {
  since: string;
  until: string;
  only: Set<string> | null;
  event: string | null;
  param: string | null;
}

function parseArgs(argv: string[]): Args {
  const get = (name: string) => {
    const i = argv.indexOf(`--${name}`);
    return i >= 0 ? argv[i + 1] ?? null : null;
  };
  const only = get("only");
  return {
    since: get("since") ?? DEFAULT_SINCE,
    until: get("until") ?? "today",
    only: only ? new Set(only.split(",")) : null,
    event: get("event"),
    param: get("param"),
  };
}

/** 환경 변수 값 앞뒤 따옴표를 벗기고 "\n" 글자를 줄바꿈으로 */
export function normalizePrivateKey(raw: string): string {
  let key = raw.trim();
  if ((key.startsWith('"') && key.endsWith('"')) || (key.startsWith("'") && key.endsWith("'"))) key = key.slice(1, -1);
  return key.replace(/\\n/g, "\n");
}

function base64url(input: string | Buffer): string {
  return Buffer.from(input).toString("base64").replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");
}

async function accessToken(email: string, privateKey: string): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = base64url(JSON.stringify({ iss: email, scope: SCOPE, aud: TOKEN_URL, iat: now, exp: now + 3600 }));
  const signer = createSign("RSA-SHA256");
  signer.update(`${header}.${claims}`);
  const assertion = `${header}.${claims}.${base64url(signer.sign(privateKey))}`;
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion }),
  });
  const body = (await res.json()) as { access_token?: string; error?: string; error_description?: string };
  if (!res.ok || !body.access_token) throw new Error(`토큰 발급 실패 (${res.status}): ${body.error ?? ""} ${body.error_description ?? ""}`);
  return body.access_token;
}

interface ReportRequest {
  dimensions?: string[];
  metrics: string[];
  orderBy?: { metric?: string; dimension?: string; desc?: boolean };
  limit?: number;
  filter?: { field: string; value: string };
}

type Row = { dims: string[]; mets: number[] };

async function runReport(token: string, property: string, range: { since: string; until: string }, req: ReportRequest): Promise<Row[]> {
  const body: Record<string, unknown> = {
    dateRanges: [{ startDate: range.since, endDate: range.until }],
    dimensions: (req.dimensions ?? []).map((name) => ({ name })),
    metrics: req.metrics.map((name) => ({ name })),
    limit: req.limit ?? 100,
  };
  if (req.orderBy) {
    body.orderBys = [
      req.orderBy.metric
        ? { metric: { metricName: req.orderBy.metric }, desc: req.orderBy.desc ?? true }
        : { dimension: { dimensionName: req.orderBy.dimension }, desc: req.orderBy.desc ?? false },
    ];
  }
  if (req.filter) {
    body.dimensionFilter = { filter: { fieldName: req.filter.field, stringFilter: { value: req.filter.value } } };
  }
  const res = await fetch(`https://analyticsdata.googleapis.com/v1beta/properties/${property}:runReport`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = (await res.json()) as {
    rows?: { dimensionValues?: { value: string }[]; metricValues?: { value: string }[] }[];
    error?: { message?: string };
  };
  if (!res.ok) throw new Error(`보고서 실패 (${res.status}): ${json.error?.message ?? ""}`);
  return (json.rows ?? []).map((r) => ({
    dims: (r.dimensionValues ?? []).map((d) => d.value),
    mets: (r.metricValues ?? []).map((m) => Number(m.value)),
  }));
}

/** 선수·팀·시즌처럼 번호가 붙은 주소를 화면 하나로 묶는다 (/player/291248 → /player/[번호]) */
export function screenOfPath(path: string): string {
  const p = path.split("?")[0].replace(/\/+$/, "") || "/";
  return p
    .replace(/^\/player\/[^/]+/, "/player/[번호]")
    .replace(/^\/team\/[^/]+/, "/team/[코드]")
    .replace(/^\/season\/[^/]+/, "/season/[코드]")
    .replace(/^\/updates\/[^/]+/, "/updates/[글]");
}

function fmt(n: number, digits = 0): string {
  return n.toLocaleString("ko-KR", { maximumFractionDigits: digits, minimumFractionDigits: digits });
}

function printTable(title: string, head: string[], rows: string[][]): void {
  console.log(`\n## ${title}`);
  if (rows.length === 0) {
    console.log("(자료 없음)");
    return;
  }
  const widths = head.map((h, i) => Math.max(h.length, ...rows.map((r) => r[i].length)));
  const line = (cells: string[]) => cells.map((c, i) => (i === 0 ? c.padEnd(widths[i]) : c.padStart(widths[i]))).join("  ");
  console.log(line(head));
  for (const r of rows) console.log(line(r));
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const property = process.env.GA4_PROPERTY_ID?.trim();
  const email = process.env.GA4_CLIENT_EMAIL?.trim();
  const rawKey = process.env.GA4_PRIVATE_KEY;
  const missing = [!property && "GA4_PROPERTY_ID", !email && "GA4_CLIENT_EMAIL", !rawKey && "GA4_PRIVATE_KEY"].filter(Boolean);
  if (missing.length > 0 || !property || !email || !rawKey) {
    console.log(`환경 변수가 없어요: ${missing.join(", ")} — Claude 클라우드 환경 설정에 넣은 뒤 새로 시작한 세션에서 실행`);
    process.exitCode = 1;
    return;
  }
  const token = await accessToken(email, normalizePrivateKey(rawKey));
  const range = { since: args.since, until: args.until };
  const want = (name: string) => !args.event && (!args.only || args.only.has(name));
  console.log(`# GA4 속성 ${property} · ${range.since} ~ ${range.until}`);

  if (args.event) {
    const dims = args.param ? [`customEvent:${args.param}`] : ["eventName"];
    const rows = await runReport(token, property, range, {
      dimensions: dims,
      metrics: ["eventCount", "totalUsers"],
      orderBy: { metric: "eventCount" },
      filter: { field: "eventName", value: args.event },
      limit: 200,
    });
    printTable(`${args.event}${args.param ? ` · ${args.param}` : ""}`, [args.param ?? "이벤트", "횟수", "사용자"], rows.map((r) => [r.dims[0], fmt(r.mets[0]), fmt(r.mets[1])]));
    return;
  }

  if (want("summary")) {
    const [r] = await runReport(token, property, range, {
      metrics: ["activeUsers", "newUsers", "sessions", "screenPageViews", "averageSessionDuration", "engagementRate", "screenPageViewsPerSession"],
    });
    const m = r?.mets ?? [];
    printTable("요약", ["항목", "값"], [
      ["활성 사용자", fmt(m[0] ?? 0)],
      ["새 사용자", fmt(m[1] ?? 0)],
      ["세션", fmt(m[2] ?? 0)],
      ["화면 조회", fmt(m[3] ?? 0)],
      ["세션당 평균 시간(초)", fmt(m[4] ?? 0)],
      ["참여율(%)", fmt((m[5] ?? 0) * 100, 1)],
      ["세션당 화면 수", fmt(m[6] ?? 0, 2)],
    ]);
  }

  if (want("daily")) {
    const rows = await runReport(token, property, range, {
      dimensions: ["date"],
      metrics: ["activeUsers", "sessions", "screenPageViews"],
      orderBy: { dimension: "date" },
      limit: 400,
    });
    printTable("일별", ["날짜", "사용자", "세션", "화면 조회"], rows.map((r) => [r.dims[0], fmt(r.mets[0]), fmt(r.mets[1]), fmt(r.mets[2])]));
  }

  if (want("pages")) {
    const rows = await runReport(token, property, range, {
      dimensions: ["pagePath"],
      metrics: ["screenPageViews", "activeUsers", "userEngagementDuration"],
      orderBy: { metric: "screenPageViews" },
      limit: 2000,
    });
    // 화면별로 묶기 — 사용자 수는 주소마다 따로 센 값이라 더하면 겹친다(참고용 상한)
    const byScreen = new Map<string, { views: number; users: number; secs: number }>();
    for (const r of rows) {
      const key = screenOfPath(r.dims[0]);
      const cur = byScreen.get(key) ?? { views: 0, users: 0, secs: 0 };
      cur.views += r.mets[0];
      cur.users += r.mets[1];
      cur.secs += r.mets[2];
      byScreen.set(key, cur);
    }
    const sorted = [...byScreen.entries()].sort((a, b) => b[1].views - a[1].views).slice(0, 40);
    printTable("화면별 (번호 주소는 묶음)", ["화면", "조회", "사용자(합)", "조회당 머문 초"], sorted.map(([k, v]) => [k, fmt(v.views), fmt(v.users), fmt(v.views ? v.secs / v.views : 0)]));
    printTable("많이 본 주소 TOP 20", ["주소", "조회", "사용자"], rows.slice(0, 20).map((r) => [r.dims[0], fmt(r.mets[0]), fmt(r.mets[1])]));
  }

  if (want("events")) {
    const rows = await runReport(token, property, range, {
      dimensions: ["eventName"],
      metrics: ["eventCount", "totalUsers"],
      orderBy: { metric: "eventCount" },
      limit: 100,
    });
    printTable("이벤트", ["이벤트", "횟수", "사용자"], rows.map((r) => [r.dims[0], fmt(r.mets[0]), fmt(r.mets[1])]));
  }

  if (want("sources")) {
    const rows = await runReport(token, property, range, {
      dimensions: ["sessionSourceMedium"],
      metrics: ["sessions", "activeUsers", "engagementRate"],
      orderBy: { metric: "sessions" },
      limit: 30,
    });
    printTable("유입 경로", ["출처 / 매체", "세션", "사용자", "참여율(%)"], rows.map((r) => [r.dims[0], fmt(r.mets[0]), fmt(r.mets[1]), fmt(r.mets[2] * 100, 1)]));
  }

  if (want("devices")) {
    const rows = await runReport(token, property, range, {
      dimensions: ["deviceCategory"],
      metrics: ["activeUsers", "sessions", "engagementRate"],
      orderBy: { metric: "activeUsers" },
    });
    printTable("기기", ["기기", "사용자", "세션", "참여율(%)"], rows.map((r) => [r.dims[0], fmt(r.mets[0]), fmt(r.mets[1]), fmt(r.mets[2] * 100, 1)]));
  }
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
