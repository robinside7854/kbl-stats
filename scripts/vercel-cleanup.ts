// Vercel 옛 배포 정리 (2026-10-05 — 무료 플랜 저장공간 10GB 초과 대응, CLAUDE.md "배포 규칙")
//
// 왜: Vercel 은 배포마다 소스 스냅샷·빌드 결과물을 보관하고, 무료(Hobby) 플랜엔 오래된 배포 자동 삭제 설정이 없다.
//     매일 수집이 main 에 커밋할 때마다 배포가 하나씩 쌓여 9/30 에 9.9GB 까지 찼다(사용자가 `vercel remove --safe` 로 비움).
// 무엇을: 이 프로젝트의 배포 목록을 받아 **남길 것**만 빼고 지운다.
//   남길 것 = 지금 운영에 걸린 배포 + 진행 중(QUEUED·BUILDING·INITIALIZING) + 완료(READY) 최근 KEEP_READY 개
//   지울 것 = 그 밖의 전부 (오래된 READY, BLOCKED·ERROR·CANCELED)
// 어디서: fetch.yml(매일 수집 뒤)·vercel-cleanup.yml(수동·주 1회). 토큰은 Actions Secrets 의 VERCEL_TOKEN — 없으면 아무것도 안 하고 끝.
// 실행: npx tsx scripts/vercel-cleanup.ts [--dry-run] [--keep N]   (dry-run 은 지울 목록만 보여 준다)
// API: GET /v6/deployments · GET /v9/projects/{id} · DELETE /v13/deployments/{id}  (https://vercel.com/docs/rest-api)

const API = "https://api.vercel.com";
/** Vercel 대시보드의 팀(robin's projects)·프로젝트(kbl-stats) 식별자 — 비밀값 아님. 다른 프로젝트에 쓰려면 환경 변수로 바꾼다 */
const TEAM_ID = process.env.VERCEL_TEAM_ID ?? "team_594ubzSHwBnHXSBkcs4TeIJB";
const PROJECT_ID = process.env.VERCEL_PROJECT_ID ?? "prj_J7KXl121MYNSMIKLOSuI6zSxNiKp";
/** 완료 배포 중 남기는 개수 — 되돌리기(Instant Rollback) 후보. 5 × (소스 50MB + 결과물 420MB) ≈ 2.4GB 상한 */
export const KEEP_READY_DEFAULT = 5;

/** 진행 중이라 건드리면 안 되는 상태 */
const IN_FLIGHT = new Set(["QUEUED", "BUILDING", "INITIALIZING"]);

export interface DeploymentLite {
  uid: string;
  state: string;
  /** Unix ms */
  created: number;
  target?: string | null;
}

/**
 * 지울 배포를 고른다 (순수 함수 — tests/vercel-cleanup.test.ts).
 * @param productionId 지금 운영에 걸린 배포 id (모르면 null — 그래도 최신 READY 는 남는다)
 */
export function pickDeletions(all: DeploymentLite[], productionId: string | null, keepReady = KEEP_READY_DEFAULT): DeploymentLite[] {
  const byNewest = [...all].sort((a, b) => b.created - a.created);
  const keep = new Set<string>();
  if (productionId) keep.add(productionId);
  let readyKept = 0;
  for (const d of byNewest) {
    if (IN_FLIGHT.has(d.state)) keep.add(d.uid);
    else if (d.state === "READY" && readyKept < keepReady) {
      keep.add(d.uid);
      readyKept++;
    }
  }
  return byNewest.filter((d) => !keep.has(d.uid));
}

async function api<T>(token: string, method: string, path: string): Promise<T> {
  const sep = path.includes("?") ? "&" : "?";
  const res = await fetch(`${API}${path}${sep}teamId=${TEAM_ID}`, { method, headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(`${method} ${path} → ${res.status} ${(await res.text()).slice(0, 200)}`);
  return (await res.json()) as T;
}

async function listAll(token: string): Promise<DeploymentLite[]> {
  const out: DeploymentLite[] = [];
  let until: number | undefined;
  for (let page = 0; page < 20; page++) {
    const q = `projectId=${PROJECT_ID}&limit=100${until ? `&until=${until}` : ""}`;
    const body = await api<{ deployments: DeploymentLite[]; pagination?: { next?: number | null } }>(token, "GET", `/v6/deployments?${q}`);
    out.push(...body.deployments);
    if (!body.pagination?.next || body.deployments.length === 0) break;
    until = body.pagination.next;
  }
  return out;
}

async function main() {
  const token = process.env.VERCEL_TOKEN;
  const dryRun = process.argv.includes("--dry-run");
  const keepArg = process.argv.indexOf("--keep");
  const keepReady = keepArg >= 0 ? Number(process.argv[keepArg + 1]) || KEEP_READY_DEFAULT : KEEP_READY_DEFAULT;
  if (!token) {
    console.log("VERCEL_TOKEN 이 없어 배포 정리를 건너뜁니다 (저장소 Settings → Secrets → Actions 에 등록)");
    return;
  }

  const project = await api<{ name: string; targets?: { production?: { id?: string } } }>(token, "GET", `/v9/projects/${PROJECT_ID}`);
  const productionId = project.targets?.production?.id ?? null;
  const all = await listAll(token);
  const doomed = pickDeletions(all, productionId, keepReady);
  console.log(`${project.name}: 배포 ${all.length}개, 운영 ${productionId ?? "?"}, 남김 ${all.length - doomed.length}개, 지울 것 ${doomed.length}개${dryRun ? " (dry-run)" : ""}`);
  for (const d of doomed) console.log(`  - ${d.uid} ${d.state} ${new Date(d.created).toISOString().slice(0, 16)} ${d.target ?? "preview"}`);
  if (dryRun) return;

  let removed = 0;
  const failed: string[] = [];
  for (const d of doomed) {
    try {
      await api(token, "DELETE", `/v13/deployments/${d.uid}`);
      removed++;
    } catch (e) {
      failed.push(`${d.uid}: ${(e as Error).message}`);
    }
  }
  console.log(`지움 ${removed}개${failed.length ? `, 실패 ${failed.length}개` : ""}`);
  for (const f of failed) console.log(`  ! ${f}`);
  if (failed.length && removed === 0) process.exitCode = 1;
}

// tsx 로 직접 실행할 때만 돈다 (테스트는 pickDeletions 만 가져간다)
const isDirect = process.argv[1]?.replace(/\\/g, "/").endsWith("scripts/vercel-cleanup.ts");
if (isDirect) {
  main().catch((e) => {
    console.error(e);
    process.exitCode = 1;
  });
}
