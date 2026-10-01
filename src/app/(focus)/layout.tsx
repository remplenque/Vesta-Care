import { CareProvider } from "@/components/CareProvider";

// Full-screen tasks with their own back button and no bottom navigation (design 03, 05)
export default function FocusLayout({ children }: { children: React.ReactNode }) {
  return (
    <CareProvider>
      <div className="mx-auto flex min-h-dvh max-w-[480px] flex-col bg-canvas">{children}</div>
    </CareProvider>
  );
}
