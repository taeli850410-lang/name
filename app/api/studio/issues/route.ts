import { NextResponse } from "next/server";
import { getIssues } from "@/lib/repo";

export const dynamic = "force-dynamic";

export async function GET() {
  const issues = await getIssues();
  return NextResponse.json({ issues });
}
