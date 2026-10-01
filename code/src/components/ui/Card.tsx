import type { HTMLAttributes, ReactNode } from "react";

interface CardProps extends HTMLAttributes<HTMLElement> {
  title?: string;
  action?: ReactNode;
  children: ReactNode;
}

export function Card({ title, action, className = "", children, ...props }: CardProps) {
  return (
    <section className={`ui-card ${className}`} {...props}>
      {(title || action) && (
        <header className="ui-card-header">
          {title && <h2 className="ui-card-title">{title}</h2>}
          {action}
        </header>
      )}
      {children}
    </section>
  );
}