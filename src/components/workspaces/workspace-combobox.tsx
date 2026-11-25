import { Combobox } from "@base-ui/react/combobox"
import { useEffect, useId, useRef } from "react"
import type { ReactNode } from "react"

import { ComboboxOptions } from "./combobox-options.tsx"

interface WorkspaceComboboxProps<TOption> {
  empty: string
  input: string
  label: string
  onChoose: (option: TOption) => void
  onInputChange: (input: string) => void
  optionKey: (option: TOption) => string
  optionLabel: (option: TOption) => string
  options: TOption[]
  placeholder: string
  renderOption: (option: TOption) => ReactNode
}

// A text box over an always-visible list (the combobox pattern, Base UI's
// inline mode). Typing filters, the arrows move, Enter chooses. Callers
// filter `options` themselves.
function WorkspaceCombobox<TOption>(props: WorkspaceComboboxProps<TOption>) {
  const id = useId()
  const box = useRef<HTMLInputElement>(null)
  // The view swaps between its list and a workspace inside one dialog, so
  // the box takes focus whenever it appears, not only when the dialog opens.
  useEffect(() => {
    box.current?.focus()
  }, [])
  return (
    <Combobox.Root<TOption>
      autoHighlight
      filter={null}
      inline
      inputValue={props.input}
      itemToStringLabel={props.optionLabel}
      items={props.options}
      onInputValueChange={props.onInputChange}
      onValueChange={(option) => {
        if (option !== null) {
          props.onChoose(option)
        }
      }}
      open
      value={null}
    >
      <div className="grid min-h-0 gap-2">
        <label className="text-xs text-muted-foreground" htmlFor={id}>
          {props.label}
        </label>
        <Combobox.Input
          className="h-10 w-full rounded-xl border border-input bg-background px-3 text-sm outline-none placeholder:text-muted-foreground focus-visible:ring-3 focus-visible:ring-ring/40"
          id={id}
          placeholder={props.placeholder}
          ref={box}
          spellCheck={false}
        />
        <ComboboxOptions
          empty={props.empty}
          optionKey={props.optionKey}
          renderOption={props.renderOption}
        />
      </div>
    </Combobox.Root>
  )
}

export { WorkspaceCombobox }
