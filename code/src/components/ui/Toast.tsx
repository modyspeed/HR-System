import { Toaster, toast } from "sonner";

export function ToastViewport({ theme }: { theme: "light" | "dark" }) {
  return <Toaster closeButton position="top-left" richColors theme={theme} />;
}

export { toast };