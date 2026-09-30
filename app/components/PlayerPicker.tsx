"use client";
// 선수 검색 콤보박스: 이름(한/영)·팀으로 걸러서 팀별로 묶어 보여준다.
import { useId, useMemo, useRef, useState } from "react";
import type { CardPlayer, CardTeam } from "@/lib/types";
import PlayerAvatar from "./PlayerAvatar";
import TeamLogo from "./TeamLogo";

interface Props {
  label: string;
  players: CardPlayer[];
  value: string | null;
  onChange: (id: string | null) => void;
  isQualified: (p: CardPlayer) => boolean;
  /** 선수의 팀 로고·색 찾기 (없으면 회색 대체 디자인) */
  teamOf?: (p: CardPlayer) => CardTeam | undefined;
  clearable?: boolean;
  placeholder?: string;
  swatchColor?: string;
}

function matches(p: CardPlayer, q: string): boolean {
  if (!q) return true;
  const s = q.trim().toLowerCase();
  return (
    p.nameKo.includes(s) ||
    p.nameEn.toLowerCase().includes(s) ||
    p.teamName.toLowerCase().includes(s) ||
    p.teamShort.toLowerCase().includes(s)
  );
}

export default function PlayerPicker({
  label,
  players,
  value,
  onChange,
  isQualified,
  teamOf,
  clearable,
  placeholder,
  swatchColor,
}: Props) {
  const id = useId();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const selected = players.find((p) => p.id === value) ?? null;

  // 팀 이름 → 이름 순으로 정렬해 팀별로 묶는다
  const filtered = useMemo(
    () =>
      players
        .filter((p) => matches(p, query))
        .sort((a, b) => a.teamName.localeCompare(b.teamName, "ko") || a.nameKo.localeCompare(b.nameKo, "ko")),
    [players, query],
  );

  function choose(p: CardPlayer) {
    onChange(p.id);
    setQuery("");
    setOpen(false);
    inputRef.current?.blur();
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setActive((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && open && filtered[active]) {
      e.preventDefault();
      choose(filtered[active]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  const listId = `${id}-list`;
  let lastTeam = "";

  return (
    <div className="relative">
      <label htmlFor={id} className="mb-1 flex items-center gap-1.5 text-xs font-medium text-ink-2">
        {swatchColor && <span aria-hidden className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: swatchColor }} />}
        {label}
      </label>
      <div className="flex gap-2">
        <input
          ref={inputRef}
          id={id}
          type="text"
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={open && filtered[active] ? `${id}-opt-${filtered[active].id}` : undefined}
          autoComplete="off"
          className="h-11 w-full min-w-0 rounded-lg border border-line bg-surface px-3 text-base text-ink placeholder:text-ink-3 focus:outline-2 focus:outline-focus"
          placeholder={selected ? `${selected.nameKo} · ${selected.teamShort}` : (placeholder ?? "이름 또는 팀 검색")}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setActive(0);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setOpen(false)}
          onKeyDown={onKeyDown}
        />
        {clearable && value && (
          <button
            type="button"
            onClick={() => onChange(null)}
            className="h-11 shrink-0 rounded-lg border border-line bg-surface px-3 text-sm text-ink-2 hover:bg-surface-2"
          >
            비교 해제
          </button>
        )}
      </div>
      {open && (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-20 mt-1 max-h-72 w-full overflow-y-auto rounded-lg border border-line bg-surface py-1 shadow-lg"
        >
          {filtered.length === 0 && <li className="px-3 py-2 text-sm text-ink-3">검색 결과가 없습니다</li>}
          {filtered.map((p, i) => {
            const header = p.teamName !== lastTeam ? p.teamName : null;
            lastTeam = p.teamName;
            const team = teamOf?.(p);
            return (
              <li key={p.id} role="presentation">
                {header && (
                  <div className="sticky top-0 z-10 flex items-center gap-1.5 bg-surface-2 px-3 py-1 text-[11px] font-semibold text-ink-3">
                    <TeamLogo logoUrl={team?.logoUrl} shortName={team?.shortName ?? p.teamShort} color={team?.color} size={16} />
                    {header}
                  </div>
                )}
                <div
                  id={`${id}-opt-${p.id}`}
                  role="option"
                  aria-selected={p.id === value}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => choose(p)}
                  onMouseEnter={() => setActive(i)}
                  className={`flex cursor-pointer items-center justify-between gap-2 px-3 py-2 text-sm ${
                    i === active ? "bg-surface-2" : ""
                  }`}
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <PlayerAvatar photoUrl={p.photoUrl} nameKo={p.nameKo} color={team?.color} size={24} />
                    <span className="min-w-0 truncate">
                      <span className="font-medium text-ink">{p.nameKo}</span>{" "}
                      <span className="text-ink-3">{p.nameEn}</span>
                    </span>
                  </span>
                  {!isQualified(p) && <span className="shrink-0 text-[11px] text-ink-3">표본 부족</span>}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
