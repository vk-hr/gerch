import type { NixChannel } from "@/lib/nix-channel"

import { useState } from "react"

const STORAGE_KEY = "gerch:nix-channel"

function read(): NixChannel {
  if (typeof window === "undefined") return "nixos-unstable"
  return localStorage.getItem(STORAGE_KEY) === "nixos-26.05"
    ? "nixos-26.05"
    : "nixos-unstable"
}

export function useNixChannel(): [NixChannel, (channel: NixChannel) => void] {
  const [channel, setChannel] = useState<NixChannel>(read)

  function update(next: NixChannel) {
    setChannel(next)
    localStorage.setItem(STORAGE_KEY, next)
  }

  return [channel, update]
}
