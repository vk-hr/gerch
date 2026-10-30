export const NIX_CHANNELS = ["nixos-unstable", "nixos-26.05"] as const
export type NixChannel = (typeof NIX_CHANNELS)[number]
