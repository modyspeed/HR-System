import type { ReactNode } from "react";
import { Modal } from "./Modal";

interface DrawerProps {
  open: boolean;
  onOpenChange(open: boolean): void;
  title: string;
  children: ReactNode;
}

export function Drawer({ open, onOpenChange, title, children }: DrawerProps) {
  return (
    <Modal open={open} onOpenChange={onOpenChange} presentation="drawer" title={title}>
      <div className="ui-drawer-content">{children}</div>
    </Modal>
  );
}