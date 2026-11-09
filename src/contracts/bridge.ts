export const BRIDGE_VERSION = 1;
export type BridgeMessage = {
  version: 1;
  channel: "uxai-review";
  frameId: string;
  type:
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
    m.channel === "uxai-review" &&
    typeof m.frameId === "string" &&
    [
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
