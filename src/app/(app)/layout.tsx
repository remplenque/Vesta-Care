import { BottomNav } from "@/components/BottomNav";
import { CareProvider } from "@/components/CareProvider";

// Main app shell: 4-item bottom navigation (design 02–07)
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <CareProvider>
      <div className="mx-auto flex min-h-dvh max-w-[480px] flex-col bg-canvas">
        <main className="flex flex-1 flex-col">{children}</main>
        <BottomNav />
      </div>
    </CareProvider>
  );
}
