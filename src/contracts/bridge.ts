import { BRAND } from "./brand.js";
export const BRIDGE_VERSION = 1;
export type BridgeMessage = {
  version: 1;
  channel: typeof BRAND.bridgeChannel;
  frameId: string;
  type:
    | "measure"
    | "resize"
    | "ready"
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
      "measure",
      "resize",
      "ready",
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
