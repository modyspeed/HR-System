import { useEffect, type ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { X } from "lucide-react";
import { IconButton } from "./IconButton";

interface ModalProps {
  open: boolean;
  onOpenChange(open: boolean): void;
  title: string;
  children: ReactNode;
  presentation?: "dialog" | "drawer";
}

export function Modal({ open, onOpenChange, title, children, presentation = "dialog" }: ModalProps) {
  const reducedMotion = useReducedMotion();
  const isDrawer = presentation === "drawer";

  useEffect(() => {
    if (!open) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onOpenChange(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onOpenChange, open]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          animate={{ opacity: 1 }}
          className={`ui-modal-backdrop${isDrawer ? " is-drawer" : ""}`}
          exit={{ opacity: 0 }}
          initial={{ opacity: 0 }}
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) onOpenChange(false);
          }}
          transition={{ duration: reducedMotion ? 0 : 0.18 }}
        >
          <motion.section
            animate={{ opacity: 1, x: 0, y: 0 }}
            aria-labelledby="ui-modal-title"
            aria-modal="true"
            className={`ui-modal${isDrawer ? " ui-modal-drawer" : ""}`}
            exit={{ opacity: 0, x: isDrawer && !reducedMotion ? 16 : 0, y: !isDrawer && !reducedMotion ? 8 : 0 }}
            initial={{ opacity: 0, x: isDrawer && !reducedMotion ? 16 : 0, y: !isDrawer && !reducedMotion ? 8 : 0 }}
            role="dialog"
            transition={{ duration: reducedMotion ? 0 : 0.18 }}
          >
            <header className="ui-modal-header">
              <h2 id="ui-modal-title">{title}</h2>
              <IconButton label="إغلاق" onClick={() => onOpenChange(false)}>
                <X size={18} aria-hidden="true" />
              </IconButton>
            </header>
            <div className="ui-modal-content">{children}</div>
          </motion.section>
        </motion.div>
      )}
    </AnimatePresence>
  );
}