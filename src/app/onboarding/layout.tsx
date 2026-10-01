import { CareProvider } from "@/components/CareProvider";

export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  return (
    <CareProvider followCriticalAlerts={false}>
      <div className="mx-auto flex min-h-dvh max-w-[480px] flex-col bg-canvas">{children}</div>
    </CareProvider>
  );
}
