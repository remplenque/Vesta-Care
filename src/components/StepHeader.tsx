import { BackButton } from "./ui";

/** Back button + "Paso n de 3" + progress segments (design 01b–01d) */
export function StepHeader({ step, back }: { step: number; back: string }) {
  return (
    <>
      <div className="flex items-center justify-between px-4 pt-2">
        <BackButton href={back} />
        <span className="pr-3 text-body text-ink-muted">Paso {step} de 3</span>
      </div>
      <div className="mx-6 mt-1 grid grid-cols-3 gap-2" aria-hidden>
        {[1, 2, 3].map((i) => (
          <div key={i} className={`h-1.5 rounded-full ${i <= step ? "bg-primary" : "bg-track-off"}`} />
        ))}
      </div>
    </>
  );
}
