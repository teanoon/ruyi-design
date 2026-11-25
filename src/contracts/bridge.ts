import { BRAND } from "./brand.js";
export const BRIDGE_VERSION = 1;
export type PreviewState = {
  stateId: string;
  query: Record<string, string>;
  hash: string;
};
export type StateRequest = {
  id: string;
  documentId: string;
  from: string;
  to: string;
  state: PreviewState;
};
export type BridgeMessage = {
  version: 1;
  channel: typeof BRAND.bridgeChannel;
  frameId: string;
  type:
    | "shortcut"
    | "shortcuts"
    | "measure"
    | "resize"
    | "ready"
    | "apply-state"
    | "state-applied"
    | "mode"
    | "selection"
    | "capture"
    | "captured"
    | "restore"
    | "restored"
    | "styles"
    | "locate"
    | "located";
  payload?: any;
};
export function isBridgeMessage(value: unknown): value is BridgeMessage {
  if (!value || typeof value !== "object") return false;
  const m = value as BridgeMessage;
  return (
    m.version === 1 &&
    m.channel === BRAND.bridgeChannel &&
    typeof m.frameId === "string" &&
    [
      "shortcut",
      "shortcuts",
      "measure",
      "resize",
      "ready",
      "apply-state",
      "state-applied",
      "mode",
      "selection",
      "capture",
      "captured",
      "restore",
      "restored",
      "styles",
      "locate",
      "located",
    ].includes(m.type)
  );
}
