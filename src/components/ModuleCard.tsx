import Link from "next/link";
import type { StatusKey } from "@/lib/status";
import { STATUS } from "@/lib/status";
import { Icon, ProgressBar, StatusBadge } from "./ui";

export type RangeInfo = { bandL: number; bandW: number; marker: number | null; label: string };

/** Range track: green band = normal range, dot = latest value. The dot's color is never the only cue */
export function RangeBar({ range, status }: { range: RangeInfo; status: StatusKey }) {
  return (
    <div className="flex flex-col gap-2.5">
      <div className="relative h-3.5 rounded-full bg-track" role="presentation">
        <div className="absolute inset-y-0 rounded-full bg-ok-band" style={{ left: `${range.bandL}%`, width: `${range.bandW}%` }} />
        {range.marker != null && (
          <div
            className={`absolute top-1/2 -mt-[13px] -ml-[13px] h-[26px] w-[26px] rounded-full border-4 border-white shadow-[0_0_0_1px_rgba(31,27,22,.25)] ${STATUS[status].marker}`}
            style={{ left: `${range.marker}%` }}
          />
        )}
      </div>
      {range.label && <div className="text-body text-ink-muted">{range.label}</div>}
    </div>
  );
}

type Props = {
  href?: string;
  name: string;
  icon: string;
  value: string;
  unit?: string;
  status: StatusKey;
  trend?: { icon: string; text: string };
  range?: RangeInfo;
  progress?: { pct: number; label: string };
  foot?: string;
};

export function ModuleCard({ href, name, icon, value, unit, status, trend, range, progress, foot }: Props) {
  const body = (
    <>
      <div className="flex items-center gap-3.5">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-sunken">
          <Icon name={icon} size="1.75rem" className="text-primary" />
        </span>
        <span className="flex-1 text-body-lg font-bold">{name}</span>
        {href && <Icon name="chevron_right" size="1.75rem" className="text-ink-subtle" />}
      </div>
      <div className="flex flex-wrap items-baseline gap-2">
        <span className="text-metric font-extrabold tracking-tight">{value}</span>
        {unit && <span className="text-body-lg font-semibold text-ink-muted">{unit}</span>}
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <StatusBadge status={status} />
        {trend && (
          <span className="flex items-center gap-1.5 text-body text-ink-muted">
            <Icon name={trend.icon} size="1.5rem" />
            {trend.text}
          </span>
        )}
      </div>
      {range && <RangeBar range={range} status={status} />}
      {progress && (
        <div className="flex flex-col gap-2.5">
          <ProgressBar pct={progress.pct} />
          <div className="text-body text-ink-muted">{progress.label}</div>
        </div>
      )}
      {foot && <div className="mt-auto border-t border-line-soft pt-3.5 text-body text-ink-subtle">{foot}</div>}
    </>
  );

  const cls = `flex flex-col gap-4 rounded-card bg-surface p-6 ${STATUS[status].border}`;
  return href ? (
    <Link href={href} className={`${cls} active:bg-canvas`}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}
