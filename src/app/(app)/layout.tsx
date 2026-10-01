import { BottomNav } from "@/components/BottomNav";
import { CareProvider } from "@/components/CareProvider";
import { ModulesBar } from "@/components/ModulesBar";

// Main app shell: modules on top, the bottom bar (panic · talk · dashboard) below. The companion
// screen (/mateo) is the home; every screen here keeps both bars
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <CareProvider>
      <div className="mx-auto flex min-h-dvh max-w-[480px] flex-col bg-canvas">
        <ModulesBar />
        <main className="flex flex-1 flex-col">{children}</main>
        <BottomNav />
      </div>
    </CareProvider>
  );
}
