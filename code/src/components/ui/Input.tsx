import { forwardRef, type InputHTMLAttributes } from "react";
import type { ReactNode } from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  startAdornment?: ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  function Input({ className = "", startAdornment, ...props }, ref) {
    return (
      <span className="ui-input-wrap">
        {startAdornment && <span className="ui-input-adornment" aria-hidden="true">{startAdornment}</span>}
        <input ref={ref} className={`ui-input ${startAdornment ? "has-adornment" : ""} ${className}`} {...props} />
      </span>
    );
  },
);