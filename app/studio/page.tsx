import { llmEnabled } from "@/lib/enrich";
import { getIssues, getMeta, getSettings } from "@/lib/repo";
import InboxClient from "./InboxClient";

export const dynamic = "force-dynamic";

export default async function InboxPage() {
  const [issues, meta, office] = await Promise.all([getIssues(), getMeta(), getSettings()]);
  return <InboxClient issues={issues} lastCollect={meta.lastCollect} llm={llmEnabled()} focusTopics={office.focusTopics ?? []} />;
}
