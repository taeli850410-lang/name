"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Icon } from "@/components/ui/Icon";

/** 로그인 — 휴대폰번호가 유일한 식별자이므로 두 칸이면 충분하다. 오류는 필드 아래 인라인으로. */
export default function LoginPage() {
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [pw, setPw] = useState("");
  const [show, setShow] = useState(false);
  const [err, setErr] = useState<{ phone?: string; pw?: string }>({});

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const next: typeof err = {};
    if (!/^01[016789]\d{7,8}$/.test(phone.replace(/\D/g, ""))) next.phone = "휴대폰번호를 숫자만 입력해 주세요. 예) 01012345678";
    if (pw.length < 8) next.pw = "비밀번호는 8자 이상입니다.";
    setErr(next);
    if (Object.keys(next).length === 0) router.push("/agent");
  };

  return (
    <main className="login">
      <section className="login__side">
        <Link href="/" className="stack" style={{ alignItems: "center", gap: 14 }} title="부동산TALK 메인 화면으로">
          <span className="mark" aria-hidden>
            부
          </span>
          <span className="name">부동산TALK</span>
        </Link>
        <div className="tag">고객과 중개사를 이어주는 바로 그 시스템</div>
      </section>
      <section className="login__form">
        <form onSubmit={submit} noValidate>
          <h1>로그인</h1>
          <div className="field">
            <label className="label" htmlFor="login-phone">
              휴대폰번호
            </label>
            <input id="login-phone" className={`input${err.phone ? " is-invalid" : ""}`} type="tel" inputMode="numeric" autoComplete="tel" placeholder="숫자만 입력 (예: 01012345678)" value={phone} onChange={(e) => setPhone(e.target.value)} aria-describedby={err.phone ? "err-phone" : undefined} />
            {err.phone && (
              <div className="error" id="err-phone">
                {err.phone}
              </div>
            )}
          </div>
          <div className="field">
            <label className="label" htmlFor="login-pw">
              비밀번호
            </label>
            <div className="input-group">
              <input id="login-pw" className={`input${err.pw ? " is-invalid" : ""}`} type={show ? "text" : "password"} autoComplete="current-password" placeholder="8자 이상" value={pw} onChange={(e) => setPw(e.target.value)} />
              <button type="button" className="btn btn--ghost btn--icon" onClick={() => setShow((v) => !v)} aria-label={show ? "비밀번호 숨기기" : "비밀번호 보기"} aria-pressed={show}>
                <Icon name={show ? "eyeOff" : "eye"} />
              </button>
            </div>
            {err.pw && <div className="error">{err.pw}</div>}
          </div>
          <label className="check">
            <input type="checkbox" defaultChecked /> 이 기기에서 로그인 유지
          </label>
          <button type="submit" className="btn btn--primary btn--lg btn--block">
            로그인
          </button>
          <Link href="/" className="btn btn--lg btn--block">
            신규가입
          </Link>
          <div className="login__links">
            <Link href="#" className="link">
              비밀번호를 잊으셨나요?
            </Link>
            <Link href="#" className="link">
              이용약관
            </Link>
          </div>
          <p className="help center">프로토타입: 형식만 맞으면 중개사 화면으로 이동합니다.</p>
        </form>
      </section>
    </main>
  );
}
