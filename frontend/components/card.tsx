import * as React from "react";

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  padding?: "none" | "sm" | "md" | "lg";
  hover?: boolean;
}

export function Card({
  className,
  children,
  padding = "md",
  hover = false,
}: CardProps) {
  const paddingClasses = {
    none: "",
    sm: "p-4",
    md: "p-6",
    lg: "p-8",
  };

  return (
    <div
      className={`rounded-xl border border-africa-border bg-africa-bg-surface shadow-sm transition-all duration-200
        ${hover ? "hover:shadow-md hover:-translate-y-1" : ""}
        ${paddingClasses[padding]} ${className}`}
    >
      {children}
    </div>
  );
}