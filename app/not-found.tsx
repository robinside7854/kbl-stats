import Link from "next/link";
import SourceFooter from "./components/SourceFooter";

export default function NotFound() {
  return (
    <>
      <main className="mx-auto max-w-3xl px-4 py-16 text-center">
        <h1 className="text-h1 font-bold">페이지를 찾을 수 없습니다</h1>
        <p className="mt-2 text-body text-ink-2">없는 시즌이거나 아직 기록이 없는 시즌입니다.</p>
        <Link href="/" className="focus-ring mt-6 inline-flex h-11 items-center rounded-lg border border-line bg-surface px-4 text-body font-semibold text-ink transition-colors duration-200 hover:bg-surface-2">
          최신 시즌으로 가기
        </Link>
      </main>
      <SourceFooter />
    </>
  );
}
