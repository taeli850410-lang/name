import { Icon, type IconName } from "@/components/ui/Icon";
import { PageHead } from "@/components/ui/Bits";
import { usefulLinks, type LinkItem } from "@/data/notices";

export const metadata = { title: "유익한 사이트" };

const GROUPS: { key: LinkItem["group"]; icon: IconName; desc: string }[] = [
  { key: "공공·행정", icon: "globe", desc: "등기·대장·실거래가·민원" },
  { key: "업무 도구", icon: "zap", desc: "매물·시세·문자" },
  { key: "커뮤니티·교육", icon: "users", desc: "카페·강의·법률" },
  { key: "중개톡", icon: "star", desc: "안내·문의·결제" },
];

export default function LinksPage() {
  return (
    <>
      <PageHead title="유익한 사이트" desc="중개 업무에 자주 쓰는 외부 사이트를 모았습니다. 새 탭에서 열립니다." />
      <div className="stack" style={{ gap: 24 }}>
        {GROUPS.map((g) => (
          <section key={g.key}>
            <div className="section-label"><Icon name={g.icon} size={14} /> {g.key} <span className="date">· {g.desc}</span></div>
            <div className="links-grid">
              {usefulLinks.filter((l) => l.group === g.key).map((l) => (
                <a key={l.title} href={l.url} target="_blank" rel="noreferrer">
                  <span className="ic"><Icon name="external" size={15} /></span>
                  <span><div className="t">{l.title}</div><div className="s">{l.desc}</div></span>
                </a>
              ))}
            </div>
          </section>
        ))}
      </div>
    </>
  );
}
