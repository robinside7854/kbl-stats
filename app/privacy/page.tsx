// 개인정보 처리 안내 (/privacy, 2026-10-03 보안 점검 — 커뮤니티 공개 전). 푸터 링크로만 들어온다(메뉴 없음).
// 2026-10-04 구글·네이버 로그인 추가: 로그인이 켜진 빌드(enabledLoginProviders)면 회원 정보 항목을 보인다.
// 로그인이 꺼져 있으면 회원·입력 양식이 없어 직접 모으는 개인정보가 없다. 적는 것: GA4 방문 통계(쿠키), 이 브라우저 저장(즐겨찾기),
// 외부 이미지(KBL 서버에서 바로 불러옴), 거부 방법, 문의처. GA4 는 page_view 로 충분해 따로 이벤트를 두지 않는다.
// 내용이 바뀌면(새 분석 도구·로그인·DB 등) 이 페이지와 시행일을 같이 고친다.
import type { Metadata } from "next";
import { shareMetadata } from "@/lib/share";
import { listSeasonsWithPlayers } from "@/lib/data";
import { gaMeasurementId } from "@/lib/analytics";
import { enabledLoginProviders, PROVIDER_LABELS } from "@/lib/account";
import site from "@/data/codes/site.json";
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
const EFFECTIVE_DATE = "2026년 10월 17일";

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
  const login = enabledLoginProviders();
  const loginNames = login.map((p) => PROVIDER_LABELS[p]).join("·");
  return (
    <>
      <SiteNav seasons={seasons} seasonCode={seasons[0]?.seasonCode ?? 0} view="privacy" />
      <main className="mx-auto max-w-3xl px-4 pb-6 pt-5">
        <h1 className="text-h1 font-black">개인정보 처리 안내</h1>
        <p className="mt-1 text-sub text-ink-3">시행일 {EFFECTIVE_DATE}</p>

        {login.length === 0 ? (
          <Section title="직접 모으는 정보">
            <p>이 사이트에는 회원가입·로그인·글쓰기가 없어서 이름, 이메일, 전화번호 같은 개인정보를 직접 모으지 않습니다.</p>
          </Section>
        ) : (
          <Section title="로그인한 회원의 정보">
            <p>{loginNames} 로그인은 원하는 분만 씁니다. 로그인하지 않아도 사이트의 모든 기록을 볼 수 있습니다.</p>
            <ul className="list-disc space-y-1 pl-5">
              <li>모으는 정보: 로그인한 회사({loginNames}), 그 회사가 주는 회원 고유 번호, 직접 정한 닉네임·응원팀, 계정에 저장한 즐겨찾기 선수 목록, 누른 좋아요(선수·팀), 54-0 게임 기록(고른 선수·시즌과 성적, 최근 200개)</li>
              <li>좋아요·팀 팬 수: 선수·팀별로 몇 명이 눌렀는지, 몇 명이 그 팀을 응원팀으로 골랐는지만 공개하고, 누가 했는지는 공개하지 않습니다</li>
              <li>54-0 주간 순위: 닉네임을 정한 회원은 그 주 가장 좋은 54-0 기록(닉네임, 대표 응원팀 색, 고른 선수·시즌과 성적)이 순위 화면에 공개됩니다. 순위에 나오고 싶지 않으면 그 기록을 내 계정 화면에서 지우면 됩니다</li>
              <li>2026년 10월 16일에 열었던 팬 MVP 투표와 경기 승부 예측은 기능을 닫으면서 받은 기록을 모두 지웠습니다</li>
              <li>모으지 않는 정보: 이메일, 이름, 전화번호, 프로필 사진 — 로그인 회사에서 받지도 저장하지도 않습니다</li>
              {login.includes("naver") && (
                <li>네이버 별명: 처음 로그인할 때 닉네임 칸에 미리 채워 드리는 데만 씁니다. 직접 저장하기 전에는 로그인 쿠키 안에만 잠시 있고, 닉네임을 저장하거나 로그아웃하면 지워집니다</li>
              )}
              <li>쓰는 곳: 로그인 상태 유지, 닉네임·응원팀 배지 표시, 여러 기기에서 즐겨찾기 맞추기, 내 계정 화면의 54-0 기록 보여 주기</li>
              {loginNames.includes("·") && (
                <li>로그인 연결: 직접 "연결하기"를 누른 경우에만 두 회사의 고유 번호를 한 계정에 묶습니다. 이메일을 받지 않으므로 자동으로 합치지 않습니다</li>
              )}
              <li>
                폰 알림(켠 회원만): 알림함에서 "켜기"를 누르면 그 기기 브라우저의 푸시 서비스(구글·애플·모질라 등)가 준 받는 주소와 암호 키를 계정에 저장하고,
                매일 기록이 들어온 뒤 즐겨찾기 선수·응원팀 소식을 보냅니다. 같은 소식을 두 번 보내지 않으려고 보낸 소식 번호를 3주 동안 적어 둡니다.
                알림 내용은 푸시 서비스를 거쳐 기기로 전달됩니다. "끄기"·로그아웃·탈퇴하면 그 기기 정보를 지웁니다
              </li>
              <li>운영자 열람: 사이트 운영자는 회원 관리를 위해 닉네임, 응원팀, 연결된 로그인 회사, 즐겨찾기·좋아요 수, 가입·수정 날짜를 볼 수 있습니다</li>
              <li>보관: 탈퇴할 때까지. 내 계정 화면에서 탈퇴하면 위 정보를 바로 지우고 따로 보관하지 않습니다</li>
              <li>로그인 쿠키: 로그인을 유지하려고 암호화된 쿠키를 씁니다(최대 30일). 이 쿠키에도 회원 고유 번호만 들어 있습니다</li>
              <li>
                맡기는 곳(국외 이전): 회원 정보는 {site.memberDb.company}의 데이터베이스 서버({site.memberDb.region})에, 사이트는 {site.memberDb.hosting}의 서버에서 처리됩니다.
                로그인하는 때에 인터넷으로 옮겨지며, 탈퇴하면 함께 지워집니다
              </li>
            </ul>
          </Section>
        )}

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
            즐겨찾기한 선수, 홈 화면 표지 순서, 마지막으로 쓴 로그인 회사(구글/네이버 — 로그인 버튼에 "최근 사용" 표시용, 탈퇴하면 지움), 로그인한 동안 마지막으로 확인한 내 닉네임·응원팀(화면 위 계정 버튼 표시용, 로그아웃·탈퇴하면 지움), 알림함에서 이미 본 소식 번호, 꺼 둔 알림 종류, 최근 본 선수 5명(검색창 추천용)은 이 기기의 브라우저 저장소(localStorage)에 남습니다. 로그인하지 않으면 어디에도 보내지 않고, 로그인하면 즐겨찾기와 꺼 둔 알림 종류만 계정에도 저장합니다(폰 알림을 보낼 때 그 종류를 빼려고). 브라우저의 사이트 데이터를 지우면 이 기기의 기록은 함께 지워집니다.
          </p>
        </Section>

        <Section title="선수 사진·팀 로고">
          <p>
            선수 사진과 팀 로고는 이 사이트에 복사하지 않고 KBL 공식 홈페이지에서 바로 불러옵니다. 이때 브라우저가 KBL 서버에 접속하므로, KBL 쪽에 일반적인 접속 기록(IP 주소, 브라우저 종류)이 남을 수 있습니다.
          </p>
        </Section>

        <Section title="경기 하이라이트 영상">
          <p>
            경기 카드의 &ldquo;하이라이트&rdquo;를 누르면 유튜브(Google)의 개인정보 보호 강화 모드(youtube-nocookie.com)로 영상을 불러옵니다. 누르기 전에는 유튜브에 접속하지 않으며, 재생하면 유튜브 쪽에 일반적인 접속 기록이 남을 수 있습니다(Google 개인정보처리방침 적용).
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
