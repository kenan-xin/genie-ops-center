"use client";

import { TRPCReactProvider } from "@/trpc/provider";

import { ThemeProvider } from "./theme-provider";
import { ConfirmProvider } from "./ui/confirm";
import { ToastProvider } from "./ui/toast";

// App-wide client providers. ToastProvider + ConfirmProvider are mounted once
// here so the shared toast (FR-SYS-01) and danger-confirm (FR-SYS-02) are
// reachable from any screen via useToast() / useConfirm().
export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <TRPCReactProvider>
        <ToastProvider>
          <ConfirmProvider>{children}</ConfirmProvider>
        </ToastProvider>
      </TRPCReactProvider>
    </ThemeProvider>
  );
}
