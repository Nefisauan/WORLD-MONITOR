import type { CSSProperties, ReactNode } from "react";

interface Props {
  title: string;
  live?: boolean;
  right?: ReactNode;
  children: ReactNode;
  style?: CSSProperties;
}

export function Panel({ title, live, right, children, style }: Props) {
  return (
    <div className="panel" style={style}>
      <div className="panel-header">
        <span className="panel-title">
          {live && <span className="live-dot" />}
          {title}
        </span>
        {right}
      </div>
      <div className="panel-body">{children}</div>
    </div>
  );
}

export function fmtPct(v: number | null | undefined, digits = 2): string {
  if (v == null || !isFinite(v)) return "—";
  return `${v >= 0 ? "+" : ""}${v.toFixed(digits)}%`;
}

export function pctClass(v: number | null | undefined): string {
  if (v == null || !isFinite(v)) return "flat";
  if (v > 0.001) return "up";
  if (v < -0.001) return "down";
  return "flat";
}

export function fmtPrice(v: number | null | undefined): string {
  if (v == null || !isFinite(v)) return "—";
  if (Math.abs(v) >= 10000) return v.toLocaleString("en-US", { maximumFractionDigits: 0 });
  if (Math.abs(v) >= 100) return v.toLocaleString("en-US", { maximumFractionDigits: 2 });
  return v.toLocaleString("en-US", { maximumFractionDigits: 4 });
}

export function timeAgo(iso: string): string {
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 90) return `${Math.round(s)}s`;
  if (s < 5400) return `${Math.round(s / 60)}m`;
  if (s < 129600) return `${Math.round(s / 3600)}h`;
  return `${Math.round(s / 86400)}d`;
}
