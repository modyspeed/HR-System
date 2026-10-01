import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import type { LucideIcon } from "lucide-react";

interface StatCardProps {
  label: string;
  value: number;
  detail: string;
  icon: LucideIcon;
  tone: "accent" | "success" | "gold" | "warning";
}

export function StatCard({ label, value, detail, icon: Icon, tone }: StatCardProps) {
  const reducedMotion = useReducedMotion();
  const [displayValue, setDisplayValue] = useState(reducedMotion ? value : 0);

  useEffect(() => {
    if (reducedMotion) {
      setDisplayValue(value);
      return;
    }

    const startTime = performance.now();
    let frame = 0;
    const animate = (now: number) => {
      const progress = Math.min((now - startTime) / 600, 1);
      setDisplayValue(Math.round(value * progress));
      if (progress < 1) frame = requestAnimationFrame(animate);
    };
    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, [reducedMotion, value]);

  return (
    <motion.article className="stat-card" whileHover={reducedMotion ? undefined : { y: -2 }}>
      <span className={`stat-icon stat-icon-${tone}`}><Icon size={20} aria-hidden="true" /></span>
      <p className="stat-label">{label}</p>
      <p className="stat-value">{displayValue.toLocaleString("en-US")}</p>
      <p className="stat-detail">{detail}</p>
    </motion.article>
  );
}