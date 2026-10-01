import type { ButtonHTMLAttributes, ReactNode } from "react";

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
  children: ReactNode;
}

export function IconButton({ label, children, className = "", ...props }: IconButtonProps) {
  return (
    <button
      aria-label={label}
      className={`ui-icon-button ${className}`}
      title={label}
      type="button"
      {...props}
    >
      {children}
    </button>
  );
}