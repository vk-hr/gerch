import { Combobox } from "@base-ui/react/combobox"
import type { ReactNode } from "react"

// The combobox's listbox, or the empty text when nothing matches.
function ComboboxOptions<TOption>({
  empty,
  optionKey,
  renderOption,
}: {
  empty: string
  optionKey: (option: TOption) => string
  renderOption: (option: TOption) => ReactNode
}) {
  return (
    <>
      <Combobox.Empty className="px-3 py-2 text-muted-foreground empty:hidden">
        {empty}
      </Combobox.Empty>
      <Combobox.List className="grid max-h-72 gap-1 overflow-y-auto overscroll-contain data-empty:hidden">
        {(option: TOption) => (
          <Combobox.Item
            className="flex cursor-default items-center gap-2.5 rounded-2xl px-3 py-2 font-medium outline-hidden select-none data-highlighted:bg-accent data-highlighted:text-accent-foreground"
            key={optionKey(option)}
            value={option}
          >
            {renderOption(option)}
          </Combobox.Item>
        )}
      </Combobox.List>
    </>
  )
}

export { ComboboxOptions }
