import * as React from "react";

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?:
    | "default"
    | "success"
    | "warning"
    | "danger"
    | "info"
    | "secondary";
}

export function Badge({
  className,
  variant = "default",
  children,
  ...props
}: BadgeProps) {
  const variants = {
    default: "bg-africa-bg-primary text-africa-text-secondary border border-africa-border",
    success:
      "bg-emerald-50 text-emerald-700 border-emerald-100",
    warning:
      "bg-amber-50 text-amber-700 border-amber-100",
    danger:
      "bg-red-50 text-red-700 border-red-100",
    info:
      "bg-blue-50 text-blue-700 border-blue-100",
    secondary:
      "bg-slate-100 text-slate-700 border-slate-200",
  };

  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${variants[variant]} ${className}`}
      {...props}
    >
      {children}
    </span>
  );
}