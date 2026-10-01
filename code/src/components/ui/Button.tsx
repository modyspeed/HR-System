import type { ButtonHTMLAttributes, ReactNode } from "react";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  icon?: ReactNode;
}

export function Button({
  variant = "secondary",
  icon,
  className = "",
  children,
  ...props
}: ButtonProps) {
  return (
    <button className={`ui-button ui-button-${variant} ${className}`} {...props}>
      {icon}
      {children}
    </button>
  );
}