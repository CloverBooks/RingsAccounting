/**
 * Companion Control Tower — Panel Routing Hook
 *
 * Manages panel open/close state via URL search params.
 * This means panel state survives page refresh and is shareable.
 */

import { useSearchParams } from "react-router-dom";
import { normalizeSurfaceKey, surfaceKeyToFilterParam, surfaceMeta } from "./helpers";
import type { PanelType } from "./companionCopy";
import type { SurfaceKey } from "./types";

export function usePanelRouting() {
  const [searchParams, setSearchParams] = useSearchParams();

  const panelParam = (searchParams.get("panel") || "").toLowerCase();
  const panel =
    panelParam === "suggestions" || panelParam === "issues" || panelParam === "close" || panelParam === "engine"
      ? (panelParam as PanelType)
      : null;

  const surfaceParam = (searchParams.get("surface") || "").toLowerCase();
  const surfaceKey = normalizeSurfaceKey(surfaceParam);
  const surfaceLabel = surfaceKey ? surfaceMeta(surfaceKey).label : null;
  const surfaceFilter = surfaceKey ? surfaceKeyToFilterParam(surfaceKey) : null;
  const agentFilter = searchParams.get("agent")?.trim() || null;

  const open = (p: PanelType, surface?: SurfaceKey, agent?: string | null) => {
    const next = new URLSearchParams(searchParams);
    next.set("panel", p);
    if (surface) {
      next.set("surface", surfaceKeyToFilterParam(surface));
    } else {
      next.delete("surface");
    }
    if (agent) {
      next.set("agent", agent);
    } else {
      next.delete("agent");
    }
    setSearchParams(next, { replace: false });
  };

  const close = () => {
    const next = new URLSearchParams(searchParams);
    next.delete("panel");
    next.delete("surface");
    next.delete("agent");
    setSearchParams(next, { replace: false });
  };

  return { panel, surfaceFilter, surfaceLabel, agentFilter, open, close };
}
