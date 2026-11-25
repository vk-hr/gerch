import { useEffect } from "react"

// Marks the page interactive once its hotkeys are registered. End-to-end
// flows wait on it before pressing keys.
function useInteractiveMarker() {
  useEffect(() => {
    document.body.dataset.interactive = ""
    return () => {
      delete document.body.dataset.interactive
    }
  }, [])
}

export { useInteractiveMarker }
