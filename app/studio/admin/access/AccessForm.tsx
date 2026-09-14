"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/**
 * 접근 관리. 스튜디오에 비밀번호를 걸거나 풉니다.
 *
 * 저장하면 그 자리에서 로그인 상태가 되도록 서버가 쿠키를 다시 심습니다 —
 * 안 그러면 저장하자마자 자기가 튕겨 나갑니다.
 */
export default function AccessForm({ envPassword, stored, canStore }: { envPassword: boolean; stored: boolean; canStore: boolean }) {
  const router = useRouter();
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [busy, setBusy] = useState<"save" | "clear" | "out" | null>(null);
  const [msg, setMsg] = useState<{ kind: "ok" | "bad"; text: string } | null>(null);

  const mismatch = pw.length > 0 && pw2.length > 0 && pw !== pw2;
  const tooShort = pw.length > 0 && pw.length < 4;

  const save = async () => {
    if (tooShort || mismatch || !pw) return;
    setBusy("save");
    setMsg(null);
    try {
      const res = await fetch("/api/studio/access", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: pw }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setMsg({ kind: "bad", text: data.error ?? "저장하지 못했습니다." });
        return;
      }
      setPw("");
      setPw2("");
      setMsg({ kind: "ok", text: "비밀번호를 걸었습니다. 다음부터 스튜디오에 들어올 때 물어봅니다." });
      router.refresh();
    } finally {
      setBusy(null);
    }
  };

  const clear = async () => {
    setBusy("clear");
    setMsg(null);
    try {
      const res = await fetch("/api/studio/access", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clear: true }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setMsg({ kind: "bad", text: data.error ?? "풀지 못했습니다." });
        return;
      }
      setMsg({ kind: "ok", text: "비밀번호를 풀었습니다. 스튜디오가 다시 누구에게나 열립니다." });
      router.refresh();
    } finally {
      setBusy(null);
    }
  };

  const logout = async () => {
    setBusy("out");
    await fetch("/api/studio/login", { method: "DELETE" });
    window.location.href = "/studio/login";
  };

  return (
    <div className="acc">
      <div className="adm-grid">
        <div className="adm-row">
          <div className="adm-row-k">지금 상태</div>
          <div>
            <span className={`adm-row-v ${envPassword || stored ? "adm-ok" : "adm-bad"}`}>
              {envPassword || stored ? "비밀번호 있음" : "누구나 열림"}
            </span>
            <span className="adm-row-note">
              {envPassword && stored
                ? "환경변수와 화면에서 건 것, 둘 다 있습니다. 어느 쪽으로도 들어올 수 있습니다."
                : envPassword
                  ? "환경변수 STUDIO_PASSWORD 로 잠겨 있습니다."
                  : stored
                    ? "이 화면에서 건 비밀번호로 잠겨 있습니다."
                    : "주소만 알면 사무소 정보·발행·수집 버튼에 모두 닿습니다."}
            </span>
          </div>
        </div>
        <div className="adm-row">
          <div className="adm-row-k">저장 위치</div>
          <div>
            <span className="adm-row-v">{canStore ? "Upstash Redis" : "저장 불가"}</span>
            <span className="adm-row-note">
              {canStore
                ? "비밀번호 원문은 저장하지 않고 SHA-256 값만 둡니다."
                : "영구 저장소가 없어 화면에서는 못 겁니다. 환경변수 STUDIO_PASSWORD 를 쓰세요."}
            </span>
          </div>
        </div>
      </div>

      {canStore && (
        <div className="acc-form">
          <div className="bn-two">
            <div className="field">
              <label htmlFor="acc-pw">새 비밀번호</label>
              <input id="acc-pw" type="password" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} placeholder="4자 이상" />
            </div>
            <div className="field">
              <label htmlFor="acc-pw2">한 번 더</label>
              <input id="acc-pw2" type="password" autoComplete="new-password" value={pw2} onChange={(e) => setPw2(e.target.value)} />
            </div>
          </div>
          {tooShort && <div className="alert alert-warn">비밀번호는 4자 이상이어야 합니다.</div>}
          {mismatch && <div className="alert alert-warn">두 칸이 다릅니다.</div>}

          <div className="bn-save">
            <button className="btn btn-primary" type="button" onClick={save} disabled={busy !== null || !pw || tooShort || mismatch}>
              {busy === "save" ? "거는 중…" : stored ? "비밀번호 바꾸기" : "비밀번호 걸기"}
            </button>
            {stored && (
              <button className="btn btn-sm btn-danger" type="button" onClick={clear} disabled={busy !== null}>
                {busy === "clear" ? "푸는 중…" : "비밀번호 풀기"}
              </button>
            )}
            {(stored || envPassword) && (
              <button className="btn btn-sm" type="button" onClick={logout} disabled={busy !== null}>
                로그아웃
              </button>
            )}
            <span className="bn-hint">저장해도 지금 쓰는 브라우저는 로그아웃되지 않습니다.</span>
          </div>
          {msg && <div className={`alert ${msg.kind === "ok" ? "alert-ok" : "alert-warn"}`}>{msg.text}</div>}
        </div>
      )}

      <div className="acc-note">
        <b>둘 중 어느 쪽이 확실한가.</b> 화면에서 건 비밀번호는 저장소(Upstash)에 있습니다. 저장소가 잠깐 흔들리면 미들웨어가 그 값을 못 읽고, 그때는 스튜디오가 다시 열립니다 — 막는 쪽으로 만들면 사무소가 자기 스튜디오에 못 들어가고 되돌릴 방법이 없어서 그렇게 뒀습니다. 어떤 경우에도 확실히 잠가야 하면 <b>Vercel → Settings → Environment Variables</b> 에 <code>STUDIO_PASSWORD</code> 를 넣고 재배포하세요. 그건 저장소와 무관하게 늘 걸립니다.
      </div>
    </div>
  );
}
