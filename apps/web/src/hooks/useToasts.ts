import { useState } from "react";
import type { Toast } from "@/types/workspace";

export function useToasts() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  function toast(message: string, type: Toast["type"] = "info", action?: Toast["action"]) {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, message, type, action }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), action ? 5500 : 4000);
  }

  function dismissToast(id: number) {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }

  return { toasts, toast, dismissToast };
}
