import * as React from "react";

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  icon?: React.ReactNode;
}

export function Input({
  className,
  label,
  error,
  icon,
  id,
  ...props
}: InputProps) {
  return (
    <div className="w-full space-y-1">
      {label && (
        <label
          htmlFor={id}
          className="block text-sm font-medium text-africa-text-secondary mb-1"
        >
          {label}
        </label>
      )}
      <div className="relative">
        {icon && (
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-africa-text-secondary">
            {icon}
          </div>
        )}
        <input
          id={id}
          className={`block w-full rounded-lg border border-africa-border bg-africa-bg-surface text-africa-text-primary placeholder-africa-text-secondary
            focus:border-africa-indigo-500 focus:ring-1 focus:ring-africa-indigo-500
            focus:outline-none transition-all duration-200
            ${error ? "border-red-500 focus:ring-red-500" : ""}
            ${icon ? "pl-10" : "pl-4"}
            pr-4 py-2.5 text-sm ${className}`}
          {...props}
        />
      </div>
      {error && (
        <p className="text-sm text-red-600">{error}</p>
      )}
    </div>
  );
}