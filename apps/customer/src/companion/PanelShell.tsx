/**
 * Panel Shell — Companion Control Tower
 *
 * Animated right-side drawer that hosts Suggestions, Issues,
 * Close Assistant, and Engine Queue panels.
 *
 * Unified zinc palette — no more warm/lux mismatch.
 */

import React, { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getPanelTitle, PanelType } from "./companionCopy";

export interface PanelShellProps {
  panel: PanelType | null;
  onClose: () => void;
  surface?: string | null;
  children: React.ReactNode;
}

export const PanelShell: React.FC<PanelShellProps> = ({ panel, onClose, surface, children }) => {
  const title = panel ? getPanelTitle(panel) : "";
  const titleId = panel ? `companion-panel-title-${panel}` : "companion-panel-title";

  // Escape key to close
  useEffect(() => {
    if (!panel) return undefined;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [panel, onClose]);

  // Lock body scroll when open
  useEffect(() => {
    if (panel) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [panel]);

  return (
    <AnimatePresence>
      {panel && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-50 bg-zinc-950/20 backdrop-blur-[2px]"
            onClick={onClose}
            aria-hidden="true"
          />

          {/* Panel */}
          <motion.aside
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            className="fixed right-0 top-0 z-50 flex h-full w-full max-w-[580px] flex-col border-l border-zinc-200 bg-white shadow-2xl"
          >
            {/* Header */}
            <header className="shrink-0 border-b border-zinc-100 bg-white px-6 py-4">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div>
                    <h2 id={titleId} className="text-base font-semibold text-zinc-900">
                      {title}
                    </h2>
                    {surface && (
                      <div className="mt-0.5 flex items-center gap-1.5">
                        <span className="text-xs text-zinc-500">Filtered by:</span>
                        <Badge variant="outline" className="rounded-md text-[10px] border-zinc-200 text-zinc-600 capitalize">
                          {surface}
                        </Badge>
                      </div>
                    )}
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={onClose}
                  className="h-8 w-8 rounded-lg text-zinc-400 hover:text-zinc-700"
                  aria-label="Close panel"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </header>

            {/* Content */}
            <div className="flex-1 overflow-auto px-6 py-5">
              {children}
            </div>

            {/* Footer */}
            <div className="shrink-0 border-t border-zinc-100 bg-zinc-50/80 px-6 py-3">
              <p className="text-[11px] text-zinc-400">
                Press <kbd className="rounded border border-zinc-200 bg-white px-1.5 py-0.5 text-[10px] font-medium text-zinc-600">Esc</kbd> to close
              </p>
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
};

export default PanelShell;
