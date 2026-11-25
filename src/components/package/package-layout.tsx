import { Link } from "@tanstack/react-router"
import type { ReactNode } from "react"

function PackageLayout({ children }: { children: ReactNode }) {
  return (
    <main className="mx-auto grid max-w-3xl gap-6 p-4 sm:p-6">
      <header className="flex h-10 items-center gap-3">
        <Link className="font-heading text-lg font-medium" to="/">
          gerch
        </Link>
      </header>
      {children}
    </main>
  )
}

export { PackageLayout }
