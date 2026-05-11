import { isAuthenticated } from "@/lib/admin";
import { snapshot } from "@/lib/store";
import { LoginForm } from "./LoginForm";
import { SupervisorPanel } from "./SupervisorPanel";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Wave · Supervision Tabaski 2026",
};

export default function SupervisorPage({
  searchParams,
}: {
  searchParams: { error?: string };
}) {
  if (!isAuthenticated()) {
    return <LoginForm error={searchParams.error === "1"} />;
  }
  const initial = snapshot();
  return <SupervisorPanel initial={initial} />;
}
