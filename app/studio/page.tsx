import { llmEnabled } from "@/lib/enrich";
import { getIssues, getMeta } from "@/lib/repo";
import InboxClient from "./InboxClient";

export const dynamic = "force-dynamic";

export default async function InboxPage() {
  const [issues, meta] = await Promise.all([getIssues(), getMeta()]);
  return <InboxClient issues={issues} lastCollect={meta.lastCollect} llm={llmEnabled()} />;
}
