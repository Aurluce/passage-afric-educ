import * as React from "react";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "outline" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
  isLoading?: boolean;
}

export function Button({
  className,
  variant = "primary",
  size = "md",
  isLoading = false,
  children,
  disabled,
  ...props
}: ButtonProps) {
  const baseStyles =
    "inline-flex items-center justify-center rounded-lg font-medium transition-all duration-200 disabled:opacity-50 disabled:pointer-events-none focus:outline-none focus:ring-2 focus:ring-offset-2";

  const variants = {
    primary:
      "bg-africa-indigo-600 text-white focus:ring-africa-indigo-500 hover:bg-africa-indigo-700 active:bg-africa-indigo-800 shadow-sm",
    secondary:
      "bg-africa-emerald-600 text-white focus:ring-africa-emerald-500 hover:bg-africa-emerald-700 active:bg-africa-emerald-800 shadow-sm",
    outline:
      "border border-africa-border bg-transparent text-africa-text-primary focus:ring-africa-indigo-500 hover:bg-africa-bg-primary active:bg-slate-100",
    ghost:
      "bg-transparent text-africa-text-secondary hover:bg-africa-bg-primary focus:ring-africa-indigo-500",
    danger:
      "bg-red-600 text-white focus:ring-red-500 hover:bg-red-700 active:bg-red-800 shadow-sm",
  };

  const sizes = {
    sm: "px-3 py-1.5 text-sm",
    md: "px-4 py-2 text-base",
    lg: "px-6 py-3 text-lg",
  };

  return (
    <button
      disabled={disabled || isLoading}
      className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${className}`}
      {...props}
    >
      {isLoading && (
        <svg
          className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          ></circle>
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          ></path>
        </svg>
      )}
      {children}
    </button>
  );
}