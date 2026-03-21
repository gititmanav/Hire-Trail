import { useState, useCallback } from "react";

interface ConfirmState {
  open: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  danger: boolean;
  resolve: ((val: boolean) => void) | null;
}

export function useConfirm() {
  const [state, setState] = useState<ConfirmState>({
    open: false,
    title: "Are you sure?",
    message: "",
    confirmLabel: "Confirm",
    danger: true,
    resolve: null,
  });

  const confirm = useCallback(
    (message: string, opts?: { title?: string; confirmLabel?: string; danger?: boolean }): Promise<boolean> => {
      return new Promise((resolve) => {
        setState({
          open: true,
          message,
          title: opts?.title || "Are you sure?",
          confirmLabel: opts?.confirmLabel || "Delete",
          danger: opts?.danger ?? true,
          resolve,
        });
      });
    },
    []
  );

  const handleConfirm = useCallback(() => {
    state.resolve?.(true);
    setState((s) => ({ ...s, open: false, resolve: null }));
  }, [state.resolve]);

  const handleCancel = useCallback(() => {
    state.resolve?.(false);
    setState((s) => ({ ...s, open: false, resolve: null }));
  }, [state.resolve]);

  return { confirm, confirmState: state, handleConfirm, handleCancel };
}
