import { redirect } from "next/navigation";
import { isAuthenticated } from "@/lib/admin";
import { reportSnapshot } from "@/lib/store";
import { ReportView } from "./ReportView";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Wave · Rapport campagne Tabaski 2026",
};

export default function ReportPage() {
  if (!isAuthenticated()) {
    redirect("/supervisor");
  }
  return <ReportView initial={reportSnapshot()} />;
}
