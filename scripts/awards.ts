// KBL 역대 수상 (2026-10-02 사용자 요청: MVP·챔프전 MVP·베스트5·수비 5걸 등을 선수 프로필에).
// 출처: 공홈 "역대수상현황"(kbl.or.kr/record/award) — API 가 아니라 화면 JS 번들 안에 표 데이터가 들어 있다
//   [{name:"정규시즌 비계량 부문 수상자", values:[{header:"2020-2024", colName:["부문","2023~2024",…], data:[{item:"MVP", value:["이선 알바노(DB)",…]}]}]}, …]
// 번들 변수 이름(data$2)은 빌드마다 바뀔 수 있어 첫 섹션 이름을 닻으로 찾는다. 원격 코드를 실행(eval)하지 않고
// 객체·배열·문자열 리터럴만 읽는 작은 파서로 읽는다(그 밖의 문법이 나오면 실패 → 저장 안 함). 순수 함수만.

type Raw = Record<string, any>;

/** 번들에서 표 데이터 시작을 찾는 닻 (첫 섹션 이름) */
export const AWARDS_ANCHOR = '[{name:"정규시즌 비계량 부문 수상자"';

/** 화면 HTML → 앱 번들 주소 경로 ("/assets/index-B80iNXgn.js"). 없으면 null */
export function bundleScriptSrc(html: string): string | null {
  const m = /src="(\/assets\/index-[^"]+\.js)"/.exec(html);
  return m ? m[1] : null;
}

class LiteralParser {
  i = 0;
  constructor(private s: string) {}
  fail(msg: string): never {
    throw new Error(`${msg} @${this.i}: ${this.s.slice(this.i, this.i + 40)}`);
  }
  ws() {
    while (this.i < this.s.length && /\s/.test(this.s[this.i])) this.i++;
  }
  value(): unknown {
    this.ws();
    const c = this.s[this.i];
    if (c === "[") return this.array();
    if (c === "{") return this.object();
    if (c === '"' || c === "'" || c === "`") return this.string();
    const m = /^-?\d+(\.\d+)?/.exec(this.s.slice(this.i, this.i + 30));
    if (m) {
      this.i += m[0].length;
      return Number(m[0]);
    }
    for (const [w, v] of [["!0", true], ["!1", false], ["true", true], ["false", false], ["null", null]] as const) {
      if (this.s.startsWith(w, this.i)) {
        this.i += w.length;
        return v;
      }
    }
    return this.fail("모르는 값");
  }
  array(): unknown[] {
    this.i++;
    const out: unknown[] = [];
    for (;;) {
      this.ws();
      if (this.s[this.i] === "]") {
        this.i++;
        return out;
      }
      out.push(this.value());
      this.ws();
      if (this.s[this.i] === ",") this.i++;
      else if (this.s[this.i] !== "]") this.fail("배열 구분자");
    }
  }
  object(): Raw {
    this.i++;
    const out: Raw = {};
    for (;;) {
      this.ws();
      if (this.s[this.i] === "}") {
        this.i++;
        return out;
      }
      let key: string;
      const c = this.s[this.i];
      if (c === '"' || c === "'" || c === "`") key = this.string();
      else {
        const m = /^[A-Za-z_$][\w$]*|^\d+/.exec(this.s.slice(this.i, this.i + 80));
        if (!m) this.fail("키");
        key = m[0];
        this.i += key.length;
      }
      this.ws();
      if (this.s[this.i] !== ":") this.fail("콜론");
      this.i++;
      out[key] = this.value();
      this.ws();
      if (this.s[this.i] === ",") this.i++;
      else if (this.s[this.i] !== "}") this.fail("객체 구분자");
    }
  }
  string(): string {
    const q = this.s[this.i++];
    let out = "";
    while (this.i < this.s.length) {
      const c = this.s[this.i++];
      if (c === q) return out;
      if (q === "`" && c === "$" && this.s[this.i] === "{") this.fail("템플릿 식");
      if (c === "\\") {
        const n = this.s[this.i++];
        if (n === "n") out += "\n";
        else if (n === "t") out += "\t";
        else if (n === "u") {
          out += String.fromCharCode(parseInt(this.s.slice(this.i, this.i + 4), 16));
          this.i += 4;
        } else if (n === "\n") continue;
        else out += n;
      } else out += c;
    }
    return this.fail("문자열이 끝나지 않음");
  }
}

/** JS 객체·배열·문자열 리터럴 하나를 읽는다 (s 의 처음부터). 실패하면 throw */
export function parseJsLiteral(s: string): unknown {
  return new LiteralParser(s).value();
}

/** 번들 → 수상 표 데이터(배열). 닻이 없거나 읽기 실패·형식이 다르면 null */
export function extractAwardsData(bundle: string): Raw[] | null {
  const at = bundle.indexOf(AWARDS_ANCHOR);
  if (at < 0) return null;
  try {
    const v = parseJsLiteral(bundle.slice(at, at + 2_000_000));
    return isAwardsData(v) ? (v as Raw[]) : null;
  } catch {
    return null;
  }
}

/** 형식 검사: [{name, values:[{colName:[…], data:[{item, value:[…]}]}]}] */
export function isAwardsData(v: unknown): boolean {
  return (
    Array.isArray(v) &&
    v.length > 0 &&
    v.every(
      (sec) =>
        sec && typeof sec.name === "string" && Array.isArray(sec.values) &&
        sec.values.every((t: Raw) => t && Array.isArray(t.colName) && Array.isArray(t.data)),
    )
  );
}

// ─────────────────────────────────────────────
// 표 → 수상 행 (시즌·부문·이름·팀). 화면에 쓰는 부문만 (감독상·인기상·페어플레이·월간/라운드 MVP·기록 부문은 뺀다)
// ─────────────────────────────────────────────

import type { AwardKey } from "../lib/types.js";
export type { AwardKey };

/** 비계량 부문 표의 item → 우리 키 (2025-26 부터 MVP 가 국내/외국으로 나뉨) */
const REGULAR_ITEM_KEYS: Record<string, AwardKey> = {
  MVP: "mvp",
  "국내선수 MVP": "mvp",
  외국선수상: "foreignMvp",
  "외국선수 MVP": "foreignMvp",
  "신인 선수상": "rookie",
  "최우수 수비상": "defensive",
  식스맨상: "sixthMan",
  "기량 발전상": "mip",
  베스트5: "best5",
  "수비 5걸상": "defense5",
};

export interface AwardRow {
  key: AwardKey;
  /** "2023-2024" / "1997" (우리 seasonLabel 형식) */
  seasonLabel: string;
  name: string;
  /** 괄호 안 팀 표기 그대로, 예: "현대모비스" */
  team: string;
}

/** "2023~2024" · "*2019~2020" · "97~98" · "99~2000" · "97" → "2023-2024" · "1997-1998" · "1999-2000" · "1997". 모르면 null */
export function awardSeasonLabel(raw: string): string | null {
  const t = String(raw).replace(/[*\s]/g, "");
  const full = (y: string) => (y.length === 2 ? (Number(y) >= 90 ? `19${y}` : `20${y}`) : y);
  let m = /^(\d{2}|\d{4})~(\d{2}|\d{4})$/.exec(t);
  if (m) return `${full(m[1])}-${full(m[2])}`;
  m = /^(\d{2}|\d{4})$/.exec(t);
  return m ? full(m[1]) : null;
}

/** 칸 하나 "이름(팀)" 여러 줄 → [{name, team}]. "-"·"※대상자 없음"·괄호 없는 줄은 뺀다. "이름\n(팀)" 처럼 줄이 나뉜 것도 붙인다 */
export function parseNameTeamCell(cell: unknown): { name: string; team: string }[] {
  const text = (Array.isArray(cell) ? cell.flat(3) : [cell]).filter((x) => typeof x === "string").join("\n");
  const joined = text.replace(/\n\s*\(/g, "(");
  const out: { name: string; team: string }[] = [];
  for (const line of joined.split("\n")) {
    const m = /^\s*\*?\s*([^()\d][^()]*?)\s*\(([^()]+)\)\s*$/.exec(line);
    if (m) out.push({ name: m[1].trim(), team: m[2].trim() });
  }
  return out;
}

/** 수상 표 데이터 → 수상 행. 섹션 이름으로 찾는다(순서가 바뀌어도 됨) */
export function awardRows(data: unknown): AwardRow[] {
  if (!isAwardsData(data)) return [];
  const out: AwardRow[] = [];
  const push = (key: AwardKey, seasonRaw: string, cell: unknown) => {
    const seasonLabel = awardSeasonLabel(seasonRaw);
    if (!seasonLabel) return;
    for (const p of parseNameTeamCell(cell)) out.push({ key, seasonLabel, ...p });
  };
  for (const sec of data as Raw[]) {
    const name = String(sec.name);
    for (const t of sec.values as Raw[]) {
      const cols = (t.colName as unknown[]).map(String);
      for (const r of t.data as Raw[]) {
        const values = Array.isArray(r.value) ? r.value : [];
        if (name === "정규시즌 비계량 부문 수상자") {
          const key = REGULAR_ITEM_KEYS[String(r.item).trim()];
          if (key) values.forEach((v: unknown, i: number) => push(key, cols[i + 1] ?? "", v));
        } else if (name === "플레이오프 우승팀 및 MVP") {
          const i = cols.indexOf("MVP");
          if (i > 0) push("finalsMvp", String(r.item), values[i - 1]);
        } else if (name === "올스타전 MVP 및 수상자") {
          const i = cols.indexOf("MVP");
          if (i > 0) push("allStarMvp", String(r.item), values[i - 1]);
        }
      }
    }
  }
  return out;
}

const normName = (s: string) => s.replace(/[\s·.\-]/g, "");

/**
 * 수상 행 → 선수 번호. 그 시즌 명단에서 이름(공백 무시)이 같은 선수 — 여럿이면 팀 표기가 겹치는 쪽.
 * 그 시즌에 없으면 전 시즌 색인에서 이름이 하나뿐인 선수. 못 찾으면 null (화면에 안 나옴, process 가 목록을 알려 준다).
 */
export function matchAwardPlayer(
  row: AwardRow,
  seasonPlayers: readonly { playerNo: string; nameKo: string; teamShort: string; teamName: string }[],
  allByName: ReadonlyMap<string, readonly string[]>,
): string | null {
  const n = normName(row.name);
  const cands = seasonPlayers.filter((p) => normName(p.nameKo) === n);
  if (cands.length === 1) return cands[0].playerNo;
  if (cands.length > 1) {
    const t = normName(row.team).toLowerCase();
    const hit = cands.filter((p) => {
      const a = normName(p.teamShort).toLowerCase();
      const b = normName(p.teamName).toLowerCase();
      return a.includes(t) || t.includes(a) || b.includes(t);
    });
    return hit.length === 1 ? hit[0].playerNo : null;
  }
  const all = allByName.get(n);
  if (all && all.length === 1) return all[0];
  // 마지막 수단: 같은 시즌·같은 팀에서 표기 차이 한 글자(장병국↔정병국, 캔디↔캐디 라렌, 카룰랑안↔카굴랑안)
  // 또는 성만 적은 경우(나이트 → 네이던 나이트). 하나로 좁혀질 때만
  const t = normName(row.team).toLowerCase();
  const sameTeam = seasonPlayers.filter((p) => {
    const a = normName(p.teamShort).toLowerCase();
    return a !== "" && (a.includes(t) || t.includes(a) || normName(p.teamName).toLowerCase().includes(t));
  });
  const near = sameTeam.filter((p) => {
    const m = normName(p.nameKo);
    const last = p.nameKo.trim().split(/\s+/).pop() ?? "";
    return editDistance(m, n) <= 1 || (!/\s/.test(row.name.trim()) && normName(last) === n);
  });
  return near.length === 1 ? near[0].playerNo : null;
}

/** 두 문자열의 편집 거리 (짧은 이름용) */
export function editDistance(a: string, b: string): number {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[a.length][b.length];
}
