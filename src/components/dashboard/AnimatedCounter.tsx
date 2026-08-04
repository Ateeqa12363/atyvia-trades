import { useEffect, useRef, useState } from "react";
import { motion, useInView, useMotionValue, useSpring, useTransform } from "framer-motion";

interface Props {
  value: number;
  prefix?: string;
  suffix?: string;
  decimals?: number;
  duration?: number;
  className?: string;
}

export function AnimatedCounter({ value, prefix = "", suffix = "", decimals, duration = 1.4, className }: Props) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "-40px" });
  const mv = useMotionValue(0);
  const spring = useSpring(mv, { duration: duration * 1000, bounce: 0 });
  const [display, setDisplay] = useState("0");

  const auto = decimals ?? (Number.isInteger(value) ? 0 : value < 10 ? 2 : 1);

  const shown = useTransform(spring, (v) => {
    const formatted = v.toLocaleString("en-GB", { minimumFractionDigits: auto, maximumFractionDigits: auto });
    return `${prefix}${formatted}${suffix}`;
  });

  useEffect(() => {
    if (inView) mv.set(value);
  }, [inView, value, mv]);

  useEffect(() => shown.on("change", (v) => setDisplay(v)), [shown]);

  return <span ref={ref} className={className}>{display}</span>;
}
