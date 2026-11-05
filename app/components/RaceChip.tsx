"use client";
// 선수 머리말 "MVP 후보 1위"·"MIP 후보 2위" 칩 (2026-11-05 시상 레이스, lib/award-race raceTagsOf) — 누르면 /records/race.
// GA4: award_race_open {place: "player"}
import Link from "next/link";
import { IconTrendUp } from "./icons";
import { trackEvent } from "./track";

export default function RaceChip({ label }: { label: string }) {
  const hash = label.startsWith("MIP") ? "mip" : "mvp";
  return (
    <Link
      href={`/records/race#${hash}`}
      onClick={() => trackEvent("award_race_open", { place: "player" })}
      className="group -my-2 inline-flex h-10 items-center rounded-control focus-ring"
    >
      <span
        className="inline-flex items-center gap-1 rounded-control px-2 py-0.5 transition-colors duration-200 group-hover:underline group-hover:underline-offset-4"
        style={{ background: "rgba(0,0,0,0.25)" }}
      >
        <IconTrendUp size={16} aria-hidden />
        {label}
      </span>
    </Link>
  );
}
