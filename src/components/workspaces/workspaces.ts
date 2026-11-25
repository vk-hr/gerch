// Pure changes to the saved workspaces, and the choices the pin picker and
// the workspace view show (flows 6 and 7 in docs/spec.md).
import type { Pin, Workspace } from "@/client/state.ts"
import type { PackageSummary, Registry } from "@/shared/registry.ts"

interface PackageRef {
  registry: Registry
  name: string
}

// One search's results from the query cache, with when they were fetched.
interface CachedResults {
  results: PackageSummary[]
  updatedAt: number
}

type PickerOption =
  | { kind: "create"; name: string }
  | { kind: "workspace"; pinned: boolean; workspace: Workspace }

function isSamePackage(left: PackageRef, right: PackageRef): boolean {
  return left.registry === right.registry && left.name === right.name
}

function normalizeName(name: string): string {
  return name.trim().toLocaleLowerCase()
}

function hasPin(workspace: Workspace, ref: PackageRef): boolean {
  return workspace.pins.some((pin) => isSamePackage(pin, ref))
}

// Returns the same array when the package is already pinned there.
function addPin(
  workspaces: Workspace[],
  workspaceId: string,
  pin: Pin
): Workspace[] {
  const target = workspaces.find((workspace) => workspace.id === workspaceId)
  if (target === undefined || hasPin(target, pin)) {
    return workspaces
  }
  return workspaces.map((workspace) =>
    workspace === target
      ? { ...workspace, pins: [...workspace.pins, pin] }
      : workspace
  )
}

// A name that exists, ignoring case and spaces, reuses that workspace.
function createWorkspace(
  workspaces: Workspace[],
  name: string,
  id: string
): { id: string; workspaces: Workspace[] } {
  const existing = workspaces.find(
    (workspace) => normalizeName(workspace.name) === normalizeName(name)
  )
  if (existing !== undefined) {
    return { id: existing.id, workspaces }
  }
  return {
    id,
    workspaces: [...workspaces, { id, name: name.trim(), pins: [] }],
  }
}

function removePin(
  workspaces: Workspace[],
  workspaceId: string,
  ref: PackageRef
): Workspace[] {
  return workspaces.map((workspace) =>
    workspace.id === workspaceId
      ? {
          ...workspace,
          pins: workspace.pins.filter((pin) => !isSamePackage(pin, ref)),
        }
      : workspace
  )
}

function deleteWorkspace(
  workspaces: Workspace[],
  workspaceId: string
): Workspace[] {
  return workspaces.filter((workspace) => workspace.id !== workspaceId)
}

function releaseTime(summary: PackageSummary): number {
  return summary.releasedAt === null ? 0 : Date.parse(summary.releasedAt)
}

// The newest cached search result for a package, or null.
function newestCached(
  ref: PackageRef,
  cached: CachedResults[]
): PackageSummary | null {
  let newest: { summary: PackageSummary; updatedAt: number } | null = null
  for (const { results, updatedAt } of cached) {
    const summary = results.find((result) => isSamePackage(result, ref))
    if (summary !== undefined && (newest?.updatedAt ?? -1) < updatedAt) {
      newest = { summary, updatedAt }
    }
  }
  return newest?.summary ?? null
}

// The card to show for a pin: the newest cached search result for it, unless
// the pin was taken from a later release than that.
function freshestSummary(pin: Pin, cached: CachedResults[]): PackageSummary {
  const summary = newestCached(pin, cached)
  return summary === null || releaseTime(summary) < releaseTime(pin.summary)
    ? pin.summary
    : summary
}

function matchingWorkspaces(
  workspaces: Workspace[],
  input: string
): Workspace[] {
  const typed = normalizeName(input)
  const matches = workspaces.filter((workspace) =>
    normalizeName(workspace.name).includes(typed)
  )
  // An exact name comes first, so Enter on "deps" never picks "deps-dev".
  const exact = matches.filter(
    (workspace) => normalizeName(workspace.name) === typed
  )
  return [
    ...exact,
    ...matches.filter((workspace) => !exact.includes(workspace)),
  ]
}

// Workspaces whose names contain the typed text, the exact name first, then
// an offer to create one with that name when none has it exactly.
function pickerOptions(
  workspaces: Workspace[],
  input: string,
  ref: PackageRef
): PickerOption[] {
  const typed = normalizeName(input)
  const options: PickerOption[] = matchingWorkspaces(workspaces, input).map(
    (workspace) => ({
      kind: "workspace",
      pinned: hasPin(workspace, ref),
      workspace,
    })
  )
  const exists = workspaces.some(
    (workspace) => normalizeName(workspace.name) === typed
  )
  return typed === "" || exists
    ? options
    : [...options, { kind: "create", name: input.trim() }]
}

function pickerOptionLabel(option: PickerOption): string {
  return option.kind === "create" ? option.name : option.workspace.name
}

export {
  addPin,
  createWorkspace,
  deleteWorkspace,
  freshestSummary,
  matchingWorkspaces,
  newestCached,
  pickerOptionLabel,
  pickerOptions,
  removePin,
}
export type { CachedResults, PackageRef, PickerOption }
