"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useMemo, useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { Badge, EmptyState, Kw, MoreMenu, PageHead, Pager, SearchBox, Switch } from "@/components/ui/Bits";
import { ConfirmModal } from "@/components/ui/Modal";
import { Drawer } from "@/components/ui/Drawer";
import { useToast } from "@/components/ui/Toast";
import { RegisterLookup, RegisterSummary } from "@/components/property/RegisterLookup";
import { properties as seed, type Property, type PropertyType } from "@/data/properties";
import { customers } from "@/data/customers";
import type { RegisterSnapshot } from "@/lib/bldrgst";
import { openPostcode } from "@/lib/daumPostcode";
import { formatManwon, TODAY } from "@/lib/format";

const TYPES: PropertyType[] = ["아파트", "오피스텔", "빌라·다세대", "상가", "토지", "단독주택"];

export default function PropertiesPage() {
  return (
    <Suspense>
      <Properties />
    </Suspense>
  );
}

function priceText(p: Property) {
  const parts: string[] = [];
  if (p.salePrice) parts.push(`매매 ${formatManwon(p.salePrice)}`);
  if (p.deposit !== undefined && p.contractTypes.some((t) => t !== "매매")) parts.push(`${p.monthly ? "보증금" : "전세"} ${formatManwon(p.deposit)}${p.monthly ? ` / 월 ${formatManwon(p.monthly)}` : ""}`);
  return parts.join(" · ") || "—";
}

function Properties() {
  const toast = useToast();
  const params = useSearchParams();
  const [list, setList] = useState<Property[]>(seed);
  const [q, setQ] = useState("");
  const [type, setType] = useState<PropertyType | "">("");
  const [page, setPage] = useState(1);
  const [detail, setDetail] = useState<Property | null>(null);
  const [newOpen, setNewOpen] = useState(params.get("new") === "1");
  const [del, setDel] = useState<Property | null>(null);

  const filtered = useMemo(() => list.filter((p) => (!q || p.name.includes(q) || p.address.includes(q) || p.keywords.some((k) => k.label.includes(q))) && (!type || p.type === type)), [list, q, type]);
  const pageItems = filtered.slice((page - 1) * 20, page * 20);

  return (
    <>
      <PageHead
        title="물건"
        desc={`${list.length}건 · 공실 ${list.filter((p) => p.tenantStatus === "공실").length} · 등기부 감시 ${list.filter((p) => p.registryWatch).length}`}
        actions={
          <>
            <button type="button" className="btn" onClick={() => toast({ tone: "info", message: "물건 목록을 엑셀로 내려받습니다. (프로토타입)" })}>
              <Icon name="download" size={15} /> 엑셀 다운로드
            </button>
            <button type="button" className="btn btn--primary" onClick={() => setNewOpen(true)}>
              <Icon name="plus" size={16} /> 물건 등록
            </button>
          </>
        }
      />
      <div className="toolbar">
        <SearchBox value={q} onChange={(v) => { setQ(v); setPage(1); }} placeholder="명칭 · 주소 · 키워드 검색" />
        <div className="chips" role="group" aria-label="유형">
          <button type="button" className={`chip${type === "" ? " is-on" : ""}`} onClick={() => setType("")}>
            전체 <span className="n">{list.length}</span>
          </button>
          {TYPES.map((t) => (
            <button key={t} type="button" className={`chip${type === t ? " is-on" : ""}`} aria-pressed={type === t} onClick={() => { setType(type === t ? "" : t); setPage(1); }}>
              {t} <span className="n">{list.filter((p) => p.type === t).length}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="table-wrap">
        {filtered.length === 0 ? (
          <EmptyState icon="building" title="조건에 맞는 물건이 없습니다" actions={<button type="button" className="btn" onClick={() => { setQ(""); setType(""); }}>필터 초기화</button>} />
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>물건</th>
                <th>유형</th>
                <th>소유자</th>
                <th>가격</th>
                <th>상태</th>
                <th>키워드</th>
                <th>등록일</th>
                <th className="th-right">관리</th>
              </tr>
            </thead>
            <tbody>
              {pageItems.map((p) => (
                <tr key={p.id} className="is-clickable" onClick={() => setDetail(p)}>
                  <td>
                    <div className="cell-title">{p.name}</div>
                    <div className="cell-sub">
                      {p.address}
                      {p.roadAddress !== "-" && <span className="faint"> · {p.roadAddress}</span>}
                    </div>
                  </td>
                  <td className="nowrap">{p.type}</td>
                  <td className="nowrap">
                    {p.ownerName ?? <span className="muted">—</span>}
                    {p.coOwner && <div className="cell-sub">공동 {p.coOwner}</div>}
                  </td>
                  <td className="nowrap">{priceText(p)}</td>
                  <td>
                    <div className="row" style={{ gap: 4 }}>
                      {p.verified ? <Badge tone="good" dot>검증됨</Badge> : <Badge tone="warn" dot>미검증</Badge>}
                      {p.tenantStatus === "임대중" && <Badge tone="info">임대중</Badge>}
                      {p.tenantStatus === "공실" && <Badge tone="neutral">공실</Badge>}
                      {p.registryWatch && <Badge tone="outline">등기 감시</Badge>}
                    </div>
                  </td>
                  <td>
                    <div className="row" style={{ gap: 4 }}>
                      {p.keywords.map((k) => (
                        <Kw key={k.label} color={k.color}>
                          {k.label}
                        </Kw>
                      ))}
                    </div>
                  </td>
                  <td className="muted num nowrap">{p.createdAt}</td>
                  <td onClick={(e) => e.stopPropagation()}>
                    <div className="row-actions">
                      <button type="button" className="btn btn--sm" onClick={() => setDetail(p)}>
                        수정
                      </button>
                      <MoreMenu
                        items={[
                          { label: "물건 실거래가 알림톡 보내기", icon: "send", onClick: () => toast({ tone: "info", message: "소유자에게 실거래가 알림톡을 보내려면 지금 발송에서 템플릿을 고르세요." }) },
                          { label: "등기소에서 단일 물건 확인", icon: "shield", onClick: () => toast({ tone: "info", message: "사무실 PC의 등기 감시 프로그램이 온라인등기소에서 물건을 확인합니다." }) },
                          { label: "삭제", icon: "trash", danger: true, onClick: () => setDel(p) },
                        ]}
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {filtered.length > 0 && <Pager total={filtered.length} page={page} pageSize={20} onPage={setPage} />}
      </div>

      <Drawer
        open={!!detail}
        onClose={() => setDetail(null)}
        title={detail?.name}
        footer={
          detail && (
            <>
              <button type="button" className="btn btn--danger-ghost" onClick={() => setDel(detail)}>
                삭제
              </button>
              <span className="grow" />
              <button type="button" className="btn btn--primary" onClick={() => { toast(`${detail.name} 정보를 저장했습니다.`); setDetail(null); }}>
                저장
              </button>
            </>
          )
        }
      >
        {detail && (
          <div className="stack" style={{ gap: 18 }}>
            <dl className="kv">
              <dt>주소</dt>
              <dd>
                {detail.address}
                <div className="muted small">도로명 {detail.roadAddress}</div>
              </dd>
              <dt>동/호/층</dt>
              <dd>{[detail.dong && `${detail.dong}동`, detail.ho && `${detail.ho}호`, detail.floor && `${detail.floor}층`].filter(Boolean).join(" · ") || "—"}</dd>
              <dt>소유자</dt>
              <dd>{detail.ownerName ?? "—"}</dd>
              <dt>면적</dt>
              <dd>{detail.areaM2 ? `${detail.areaM2}㎡ · ${(detail.areaM2 / 3.3058).toFixed(1)}평` : "—"}</dd>
              <dt>주차</dt>
              <dd>{detail.parking ? `${detail.parking}대` : "—"}</dd>
              <dt>가격</dt>
              <dd>{priceText(detail)}</dd>
              <dt>주소 검증</dt>
              <dd>{detail.verified ? <Badge tone="good" dot>온라인등기소 단일 물건 확인 완료</Badge> : <Badge tone="warn" dot>미검증 — 임대차 물건은 확인이 필요합니다</Badge>}</dd>
            </dl>
            <div>
              <div className="section-label">건축물대장</div>
              {detail.register && <RegisterSummary snapshot={detail.register} />}
              <div className={detail.register ? "mt-8" : ""}>
                <RegisterLookup
                  source={detail.bcode && detail.jibunAddress ? { bcode: detail.bcode, jibunAddress: detail.jibunAddress } : null}
                  dongHint={detail.dong}
                  applyLabel={detail.register ? "이 내용으로 갱신" : "물건 정보에 반영"}
                  onApply={(patch, snapshot) => {
                    const next: Property = {
                      ...detail,
                      register: snapshot,
                      type: patch.type ?? detail.type,
                      areaM2: patch.areaM2 ?? detail.areaM2,
                      parking: patch.parking ?? detail.parking,
                      floor: detail.floor || (patch.totalFloor ? `/${patch.totalFloor}` : undefined),
                    };
                    setList((xs) => xs.map((p) => (p.id === detail.id ? next : p)));
                    setDetail(next);
                    toast("건축물대장 내용을 물건에 반영했습니다.");
                  }}
                />
              </div>
            </div>

            <div className="card" style={{ boxShadow: "none" }}>
              <div className="card__body row row--between">
                <div>
                  <div className="strong">등기부 변동 감시</div>
                  <div className="muted small">하루 두 번(10:00 · 17:00) 사무실 PC에서 자동 조회합니다.</div>
                </div>
                <Switch checked={detail.registryWatch} onChange={(v) => { setList((xs) => xs.map((p) => (p.id === detail.id ? { ...p, registryWatch: v } : p))); setDetail({ ...detail, registryWatch: v }); toast(v ? "등기부 감시를 켰습니다. 다음 조회부터 포함됩니다." : "등기부 감시를 껐습니다."); }} label={detail.registryWatch ? "켜짐" : "꺼짐"} />
              </div>
            </div>
            <div>
              <div className="section-label">메모 키워드</div>
              <div className="row" style={{ gap: 4 }}>
                {detail.keywords.map((k) => <Kw key={k.label} color={k.color}>{k.label}</Kw>)}
                <button type="button" className="chip" onClick={() => toast("키워드 관리는 나의 정보 › 메모 키워드에서 합니다.")}>
                  + 키워드
                </button>
              </div>
            </div>
          </div>
        )}
      </Drawer>

      <Drawer open={newOpen} onClose={() => setNewOpen(false)} title="물건 등록">
        <NewPropertyForm
          onCancel={() => setNewOpen(false)}
          onSave={(p) => {
            setList((xs) => [p, ...xs]);
            setNewOpen(false);
            toast(`${p.name}을(를) 등록했습니다.`);
          }}
        />
      </Drawer>

      <ConfirmModal
        open={!!del}
        onClose={() => setDel(null)}
        danger
        title={`${del?.name}을(를) 삭제할까요?`}
        description="연결된 계약은 유지되고 등기부 감시는 중단됩니다. 30일 안에 복구할 수 있습니다."
        confirmLabel="삭제"
        onConfirm={() => {
          if (del) {
            const d = del;
            setList((xs) => xs.filter((p) => p.id !== d.id));
            setDetail(null);
            toast({ message: `${d.name}을(를) 삭제했습니다.`, action: { label: "실행 취소", onClick: () => setList((xs) => [d, ...xs]) } });
          }
          setDel(null);
        }}
      />
    </>
  );
}

function NewPropertyForm({ onSave, onCancel }: { onSave: (p: Property) => void; onCancel: () => void }) {
  const [name, setName] = useState("");
  const [type, setType] = useState<PropertyType>("아파트");
  const [address, setAddress] = useState("");
  const [addrMeta, setAddrMeta] = useState<{ bcode: string; jibunAddress: string; roadAddress: string } | null>(null);
  const [register, setRegister] = useState<RegisterSnapshot | null>(null);
  const [searchBlocked, setSearchBlocked] = useState(false);
  const [dong, setDong] = useState("");
  const [ho, setHo] = useState("");
  const [floor, setFloor] = useState("");
  const [owner, setOwner] = useState("");
  const [m2, setM2] = useState("");
  const [py, setPy] = useState("");
  const [parking, setParking] = useState("");
  const [ctypes, setCtypes] = useState<("매매" | "전세" | "월세")[]>([]);
  const [sale, setSale] = useState("");
  const [deposit, setDeposit] = useState("");
  const [monthly, setMonthly] = useState("");
  const [err, setErr] = useState<Record<string, string>>({});

  const setArea = (v: string, from: "m2" | "py") => {
    if (from === "m2") {
      setM2(v);
      setPy(v ? (Number(v) / 3.3058).toFixed(1) : "");
    } else {
      setPy(v);
      setM2(v ? (Number(v) * 3.3058).toFixed(1) : "");
    }
  };
  const isRent = ctypes.includes("전세") || ctypes.includes("월세");

  /** 주소 검색 — 법정동코드까지 받아 둬야 건축물대장을 조회할 수 있다. */
  const searchAddress = async () => {
    const r = await openPostcode();
    if (!r) {
      setSearchBlocked(true);
      return;
    }
    setSearchBlocked(false);
    setAddress(r.jibunAddress || r.address);
    setAddrMeta({ bcode: r.bcode, jibunAddress: r.jibunAddress, roadAddress: r.roadAddress });
    setRegister(null);
    if (!name.trim() && r.buildingName) setName(r.buildingName);
    setErr((e) => ({ ...e, address: "" }));
  };

  const submit = () => {
    const e: Record<string, string> = {};
    if (!name.trim()) e.name = "명칭을 입력해 주세요.";
    if (!address.trim()) e.address = "주소를 검색해 선택해 주세요.";
    if (ctypes.length === 0) e.ctypes = "계약방식을 하나 이상 고르세요.";
    setErr(e);
    if (Object.keys(e).length) return;
    const o = customers.find((c) => c.id === owner);
    onSave({
      id: `p${Date.now()}`,
      name: name.trim(),
      type,
      address: address.trim(),
      roadAddress: addrMeta?.roadAddress || "-",
      bcode: addrMeta?.bcode,
      jibunAddress: addrMeta?.jibunAddress,
      register: register ?? undefined,
      dong: dong || undefined,
      ho: ho || undefined,
      floor: floor || undefined,
      ownerId: o?.id,
      ownerName: o?.name,
      areaM2: m2 ? Number(m2) : undefined,
      parking: parking ? Number(parking) : undefined,
      contractTypes: ctypes,
      salePrice: sale ? Number(sale) : undefined,
      deposit: deposit ? Number(deposit) : undefined,
      monthly: monthly ? Number(monthly) : undefined,
      verified: false,
      registryWatch: isRent,
      tenantStatus: isRent ? "공실" : "-",
      keywords: [],
      createdAt: TODAY,
    });
  };
  return (
    <div className="form">
      <div className="form-grid-2">
        <div className="field">
          <label className="label" htmlFor="np-name">
            명칭 <span className="req">*</span>
          </label>
          <input id="np-name" className={`input${err.name ? " is-invalid" : ""}`} placeholder="예: 더샵부평 110동 103호" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
          {err.name && <div className="error">{err.name}</div>}
        </div>
        <div className="field">
          <label className="label" htmlFor="np-type">
            유형
          </label>
          <select id="np-type" className="select" value={type} onChange={(e) => setType(e.target.value as PropertyType)}>
            {TYPES.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </div>
      </div>
      <div className="field">
        <label className="label" htmlFor="np-addr">
          주소 <span className="req">*</span>
        </label>
        <div className="input-group">
          <input id="np-addr" className={`input${err.address ? " is-invalid" : ""}`} placeholder="도로명 또는 지번으로 검색" value={address} onChange={(e) => { setAddress(e.target.value); setAddrMeta(null); }} />
          <button type="button" className="btn" onClick={searchAddress}>
            <Icon name="search" size={14} /> 검색
          </button>
        </div>
        {err.address && <div className="error">{err.address}</div>}
        {addrMeta ? (
          <div className="addr-picked">
            <Icon name="checkCircle" size={14} style={{ color: "var(--good)" }} />
            <span>
              지번 <b>{addrMeta.jibunAddress}</b>
            </span>
            {addrMeta.roadAddress && <span className="faint">도로명 {addrMeta.roadAddress}</span>}
            <span className="k">법정동 {addrMeta.bcode}</span>
          </div>
        ) : (
          <div className="help">동/호를 입력해야 등기소 단일 물건 확인과 실거래가 조회가 정확합니다. 빌라 등 동이 없으면 동은 비워 두세요.</div>
        )}
        {searchBlocked && <div className="help">주소 검색 창을 열지 못했습니다. 주소를 직접 입력하면 저장은 되지만, 법정동코드가 없어 건축물대장은 조회할 수 없습니다.</div>}
      </div>

      <RegisterLookup
        source={addrMeta?.bcode ? { bcode: addrMeta.bcode, jibunAddress: addrMeta.jibunAddress } : null}
        dongHint={dong}
        onApply={(patch, snapshot) => {
          if (patch.name && !name.trim()) setName(patch.name);
          if (patch.type) setType(patch.type);
          if (patch.totalFloor) setFloor((f) => (f.includes("/") ? f : `${f || ""}/${patch.totalFloor}`));
          if (patch.areaM2) setArea(String(Math.round(patch.areaM2 * 100) / 100), "m2");
          if (patch.parking != null) setParking(String(patch.parking));
          setRegister(snapshot);
        }}
      />
      <div className="form-grid-2">
        <div className="field">
          <span className="label">동 / 호</span>
          <div className="input-group">
            <input className="input" placeholder="동" value={dong} onChange={(e) => setDong(e.target.value)} aria-label="동" />
            <input className="input" placeholder="호" value={ho} onChange={(e) => setHo(e.target.value)} aria-label="호" />
          </div>
        </div>
        <div className="field">
          <label className="label" htmlFor="np-floor">
            소재층 / 전체층
          </label>
          <input id="np-floor" className="input" placeholder="예: 8/20" value={floor} onChange={(e) => setFloor(e.target.value)} />
        </div>
      </div>
      <div className="form-grid-2">
        <div className="field">
          <label className="label" htmlFor="np-owner">
            소유자 <span className="opt">고객 중 선택</span>
          </label>
          <select id="np-owner" className="select" value={owner} onChange={(e) => setOwner(e.target.value)}>
            <option value="">선택 안 함</option>
            {customers.slice(0, 40).map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <span className="label">면적</span>
          <div className="input-group">
            <input className="input" inputMode="decimal" placeholder="㎡" value={m2} onChange={(e) => setArea(e.target.value, "m2")} aria-label="제곱미터" />
            <span className="unit">=</span>
            <input className="input" inputMode="decimal" placeholder="평" value={py} onChange={(e) => setArea(e.target.value, "py")} aria-label="평" />
          </div>
          <div className="help">두 값은 자동 환산됩니다 (1평 ≈ 3.3058㎡).</div>
        </div>
      </div>
      <div className="field" style={{ maxWidth: 220 }}>
        <label className="label" htmlFor="np-parking">
          주차대수 <span className="opt">세대당</span>
        </label>
        <div className="input-group">
          <input id="np-parking" className="input" inputMode="decimal" placeholder="예: 1.2" value={parking} onChange={(e) => setParking(e.target.value)} />
          <span className="unit">대</span>
        </div>
      </div>
      <div className="field">
        <span className="label">
          계약방식 <span className="req">*</span>
        </span>
        <div className="chips">
          {(["매매", "전세", "월세"] as const).map((t) => (
            <button key={t} type="button" className={`chip${ctypes.includes(t) ? " is-on" : ""}`} aria-pressed={ctypes.includes(t)} onClick={() => setCtypes(ctypes.includes(t) ? ctypes.filter((x) => x !== t) : [...ctypes, t])}>
              {t}
            </button>
          ))}
        </div>
        {err.ctypes && <div className="error">{err.ctypes}</div>}
      </div>
      {ctypes.includes("매매") && (
        <div className="field">
          <label className="label" htmlFor="np-sale">
            매매가
          </label>
          <div className="input-group">
            <input id="np-sale" className="input" inputMode="numeric" placeholder="예: 35,000" value={sale} onChange={(e) => setSale(e.target.value)} />
            <span className="unit">만원</span>
          </div>
          {sale && <div className="help">= {formatManwon(Number(sale))}</div>}
        </div>
      )}
      {isRent && (
        <div className="form-grid-2">
          <div className="field">
            <label className="label" htmlFor="np-dep">
              보증금
            </label>
            <div className="input-group">
              <input id="np-dep" className="input" inputMode="numeric" placeholder="예: 30,000" value={deposit} onChange={(e) => setDeposit(e.target.value)} />
              <span className="unit">만원</span>
            </div>
          </div>
          {ctypes.includes("월세") && (
            <div className="field">
              <label className="label" htmlFor="np-mon">
                월세
              </label>
              <div className="input-group">
                <input id="np-mon" className="input" inputMode="numeric" placeholder="예: 120" value={monthly} onChange={(e) => setMonthly(e.target.value)} />
                <span className="unit">만원</span>
              </div>
            </div>
          )}
        </div>
      )}
      {isRent && <p className="help">임대차 물건은 등기부 변동 감시가 자동으로 켜집니다. 저장 후 사무실 PC가 등기소에서 단일 물건을 확인합니다.</p>}
      <div className="row row--end">
        <button type="button" className="btn btn--ghost" onClick={onCancel}>
          취소
        </button>
        <button type="button" className="btn btn--primary" onClick={submit}>
          등록
        </button>
      </div>
    </div>
  );
}
