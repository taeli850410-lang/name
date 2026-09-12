"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function RefreshMarketButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [notes, setNotes] = useState<string[] | null>(null);
  async function run() {
    setBusy(true);
    setNotes(null);
    try {
      const res = await fetch("/api/studio/market", { method: "POST" });
      const data = (await res.json()) as { notes?: string[]; error?: string };
      if (!res.ok) throw new Error(data.error || res.statusText);
      setNotes(data.notes ?? []);
      router.refresh();
    } catch (e) {
      setNotes([`갱신 실패: ${(e as Error).message}`]);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div style={{ textAlign: "right" }}>
      <button className="btn" onClick={run} disabled={busy}>
        {busy ? "갱신 중…" : "시장 데이터 갱신"}
      </button>
      {notes && (
        <ul className="small muted" style={{ textAlign: "left", marginTop: 8, maxWidth: 420 }}>
          {notes.map((n, i) => (
            <li key={i}>{n}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
