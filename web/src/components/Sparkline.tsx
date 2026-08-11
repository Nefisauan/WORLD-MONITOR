import { useEffect, useRef } from "react";

interface Props {
  data: number[];
  width?: number;
  height?: number;
  color?: string;
}

export function Sparkline({ data, width = 64, height = 18, color }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas || data.length < 2) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    const ctx = canvas.getContext("2d")!;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, width, height);

    const min = Math.min(...data);
    const max = Math.max(...data);
    const range = max - min || 1;
    const stroke = color ?? (data[data.length - 1] >= data[0] ? "#2ee076" : "#ff4d5e");

    ctx.beginPath();
    data.forEach((v, i) => {
      const x = (i / (data.length - 1)) * (width - 2) + 1;
      const y = height - 2 - ((v - min) / range) * (height - 4);
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    });
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 1;
    ctx.stroke();

    // subtle fill
    ctx.lineTo(width - 1, height - 1);
    ctx.lineTo(1, height - 1);
    ctx.closePath();
    ctx.fillStyle = stroke + "18";
    ctx.fill();
  }, [data, width, height, color]);

  return <canvas ref={ref} className="spark-canvas" style={{ width, height }} />;
}
