"use client";
// 푸터 "만든 사람" 줄 (2026-10-02 사용자 지정, 값은 data/codes/site.json developer).
// GA4: 문의 메일 누르기 contact_click(매개변수 없음 — 주소는 보내지 않는다). 이메일은 브라우저에서 이어 붙인다 — 정적 HTML 에는 "user [at] domain" 글자만 남아 주소 수집기가 그대로 긁어 가기 어렵다.
import { useEffect, useState } from "react";
import site from "@/data/codes/site.json";
import { trackEvent } from "./track";

export default function DeveloperContact() {
  const { name, emailUser, emailDomain } = site.developer;
  const [email, setEmail] = useState<string | null>(null);
  useEffect(() => setEmail(`${emailUser}@${emailDomain}`), [emailUser, emailDomain]);
  return (
    <p className="mt-1">
      만든 사람: {name} · 문의{" "}
      {email ? (
        <a href={`mailto:${email}`} onClick={() => trackEvent("contact_click")} className="focus-ring rounded-md underline underline-offset-2 transition-colors duration-200 hover:text-ink">
          {email}
        </a>
      ) : (
        <span>
          {emailUser} [at] {emailDomain}
        </span>
      )}
    </p>
  );
}
