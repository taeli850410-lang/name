import LoginForm from "./LoginForm";

export const dynamic = "force-dynamic";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  return (
    <div className="login card">
      <h1 style={{ fontSize: 20 }}>스튜디오 로그인</h1>
      <p className="small muted">STUDIO_PASSWORD 환경변수에 설정한 비밀번호를 입력하세요.</p>
      <LoginForm next={next && next.startsWith("/") ? next : "/studio"} />
    </div>
  );
}
