import { Brand, Button, Icon } from "@/components/ui";

// 01a · Bienvenida
export default function Welcome() {
  return (
    <div className="mx-auto flex min-h-dvh max-w-[480px] flex-col bg-canvas">
      <div className="px-6 pt-6">
        <Brand />
      </div>

      <div
        className="relative mx-6 mt-7 flex h-[300px] items-end overflow-hidden rounded-card p-5"
        style={{ background: "radial-gradient(120% 90% at 85% 10%, #F3DDBF 0%, #EFEAE2 45%, #E8E2D8 100%)" }}
        aria-hidden
      >
        <div className="absolute top-8 right-8 flex h-28 w-28 items-center justify-center rounded-full bg-brand/90 text-white">
          <Icon name="home_health" size="3.5rem" />
        </div>
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-3 self-start rounded-full bg-surface py-2 pr-4 pl-2 shadow-sm">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-ok-soft text-ok">
              <Icon name="check_circle" fill size="1.5rem" />
            </span>
            <span className="text-body font-bold">Presión en rango</span>
          </div>
          <div className="flex items-center gap-3 self-start rounded-full bg-surface py-2 pr-4 pl-2 shadow-sm">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-soft text-primary">
              <Icon name="medication" size="1.5rem" />
            </span>
            <span className="text-body font-bold">Remedios al día</span>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-4 px-6 pt-8">
        <h1 className="text-display font-extrabold tracking-tight text-pretty">Su salud, en orden y en sus manos.</h1>
        <p className="text-body-lg text-ink-muted text-pretty">
          Mateo le acompaña cada día, le recuerda sus remedios y avisa a su familia solo si algo no anda bien.
        </p>
      </div>

      <div className="mt-auto flex flex-col gap-3 p-6">
        <Button href="/onboarding/ficha">Comenzar</Button>
        <Button href="/ingresar" variant="text">
          Ya tengo una cuenta
        </Button>
      </div>
    </div>
  );
}
