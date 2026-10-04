// 개인정보 처리 안내 (/privacy, 2026-10-03 보안 점검 — 커뮤니티 공개 전). 푸터 링크로만 들어온다(메뉴 없음).
// 이 사이트는 회원·입력 양식이 없어 직접 모으는 개인정보가 없다. 적는 것: GA4 방문 통계(쿠키), 이 브라우저 저장(즐겨찾기),
// 외부 이미지(KBL 서버에서 바로 불러옴), 거부 방법, 문의처. GA4 는 page_view 로 충분해 따로 이벤트를 두지 않는다.
// 내용이 바뀌면(새 분석 도구·로그인·DB 등) 이 페이지와 시행일을 같이 고친다.
import type { Metadata } from "next";
import { shareMetadata } from "@/lib/share";
import { listSeasonsWithPlayers } from "@/lib/data";
import { gaMeasurementId } from "@/lib/analytics";
import { IconExternal } from "@/app/components/icons";
import DeveloperContact from "@/app/components/DeveloperContact";
import SiteNav from "@/app/components/SiteNav";
import SourceFooter from "@/app/components/SourceFooter";

export const metadata: Metadata = shareMetadata({
  title: "개인정보 처리 안내 · KBL - Stats Reference",
  description: "이 사이트가 모으는 정보(방문 통계)와 거부하는 방법. 비영리 팬 프로젝트.",
  path: "/privacy",
});

/** 시행일 — 내용을 바꾸면 같이 고친다 */
const EFFECTIVE_DATE = "2026년 10월 3일";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-6">
      <h2 className="text-h2 font-bold">{title}</h2>
      <div className="mt-2 space-y-2 text-body leading-relaxed text-ink-2">{children}</div>
    </section>
  );
}

function ExtLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="focus-ring inline-flex items-center gap-0.5 rounded-control font-semibold text-ink underline underline-offset-2"
    >
      {children}
      <IconExternal size={16} />
    </a>
  );
}

export default function PrivacyPage() {
  const seasons = listSeasonsWithPlayers();
  const ga = !!gaMeasurementId();
  return (
    <>
      <SiteNav seasons={seasons} seasonCode={seasons[0]?.seasonCode ?? 0} view="privacy" />
      <main className="mx-auto max-w-3xl px-4 pb-6 pt-5">
        <h1 className="text-h1 font-black">개인정보 처리 안내</h1>
        <p className="mt-1 text-sub text-ink-3">시행일 {EFFECTIVE_DATE}</p>

        <Section title="직접 모으는 정보">
          <p>
            이 사이트에는 회원가입·로그인·글쓰기가 없어서 이름, 이메일, 전화번호 같은 개인정보를 직접 모으지 않습니다.
          </p>
        </Section>

        <Section title="방문 통계 (Google Analytics)">
          <p>
            어떤 화면과 기능을 많이 쓰는지 알아보려고 Google Analytics 4를 씁니다.{ga ? "" : " (지금 이 화면은 통계가 꺼진 미리보기입니다.)"}
          </p>
          <ul className="list-disc space-y-1 pl-5">
            <li>모이는 정보: 본 화면, 누른 버튼(예: 시즌·필터 선택, 선수 번호), 기기·브라우저 종류, 대략적인 지역(국가·도시), 쿠키에 저장되는 무작위 방문자 번호</li>
            <li>Google 이 IP 주소로 지역을 짐작하지만, Google Analytics 4는 IP 주소를 저장하지 않습니다</li>
            <li>검색창에 입력한 글자는 보내지 않습니다</li>
            <li>쓰는 곳: 사이트 개선용 통계로만 보고, 광고나 다른 서비스와 연결하지 않습니다</li>
            <li>보관: Google Analytics 설정에 따라 최대 14개월 뒤 자동으로 지워집니다</li>
          </ul>
          <p>
            원하지 않으면 브라우저 설정에서 쿠키를 막거나 Google 의{" "}
            <ExtLink href="https://tools.google.com/dlpage/gaoptout?hl=ko">애널리틱스 차단 부가 기능</ExtLink>을 쓰면 됩니다. 사이트는 그대로 쓸 수 있습니다.
            Google 의 처리 방식은 <ExtLink href="https://policies.google.com/privacy?hl=ko">Google 개인정보처리방침</ExtLink>에 있습니다.
          </p>
        </Section>

        <Section title="이 브라우저에만 저장하는 것">
          <p>
            즐겨찾기한 선수와 홈 화면 표지 순서는 이 기기의 브라우저 저장소(localStorage)에만 남고, 어디에도 보내지 않습니다. 브라우저의 사이트 데이터를 지우면 함께 지워집니다.
          </p>
        </Section>

        <Section title="선수 사진·팀 로고">
          <p>
            선수 사진과 팀 로고는 이 사이트에 복사하지 않고 KBL 공식 홈페이지에서 바로 불러옵니다. 이때 브라우저가 KBL 서버에 접속하므로, KBL 쪽에 일반적인 접속 기록(IP 주소, 브라우저 종류)이 남을 수 있습니다.
          </p>
        </Section>

        <Section title="문의">
          <p>개인정보·사진 삭제 요청이나 문의는 아래 이메일로 보내 주세요.</p>
          <DeveloperContact />
        </Section>
      </main>
      <SourceFooter />
    </>
  );
}
