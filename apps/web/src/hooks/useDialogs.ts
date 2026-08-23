import { useState } from "react";
import type { ConfirmState, PromptState } from "@/types/workspace";

export function useDialogs() {
  const [confirmDialog, setConfirmDialog] = useState<ConfirmState>(null);
  const [promptDialog, setPromptDialog] = useState<PromptState>(null);
  const [promptValue, setPromptValue] = useState("");

  function confirmAction(message: string) {
    return new Promise<boolean>((resolve) => setConfirmDialog({ message, resolve }));
  }

  function promptInput(label: string, defaultValue = "") {
    return new Promise<string | null>((resolve) => {
      setPromptValue(defaultValue);
      setPromptDialog({ label, defaultValue, resolve });
    });
  }

  function resolveConfirm(ok: boolean) {
    confirmDialog?.resolve(ok);
    setConfirmDialog(null);
  }

  function resolvePrompt(value: string | null) {
    promptDialog?.resolve(value);
    setPromptDialog(null);
  }

  return {
    confirmDialog,
    confirmAction,
    resolveConfirm,
    promptDialog,
    promptValue,
    setPromptValue,
    promptInput,
    resolvePrompt
  };
}
