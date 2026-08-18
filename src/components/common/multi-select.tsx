import { CheckIcon, ChevronsUpDownIcon, XIcon } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"

export interface MultiSelectOption {
  value: string
  label: string
  /** Secondary text — a code, a native name. */
  hint?: string
  /** Cannot be removed. Used for a project's default language. */
  locked?: boolean
}

interface MultiSelectProps {
  options: MultiSelectOption[]
  value: string[]
  onChange: (value: string[]) => void
  placeholder?: string
  id?: string
  "aria-invalid"?: boolean
  disabled?: boolean
  className?: string
}

/**
 * Multi-select with the selection shown as removable chips.
 *
 * Chips rather than a comma list: language sets run long, and a user needs to remove one
 * without retyping the rest. `locked` options render without an X — a project cannot drop
 * the language its keys are authored in.
 */
export function MultiSelect({
  options,
  value,
  onChange,
  placeholder = "Select…",
  id,
  disabled,
  className,
  ...aria
}: MultiSelectProps) {
  const selected = options.filter((option) => value.includes(option.value))

  const toggle = (option: MultiSelectOption) => {
    if (option.locked && value.includes(option.value)) {
      return
    }

    onChange(
      value.includes(option.value)
        ? value.filter((item) => item !== option.value)
        : [...value, option.value]
    )
  }

  return (
    <div className={cn("space-y-1.5", className)}>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              id={id}
              variant="outline"
              disabled={disabled}
              aria-invalid={aria["aria-invalid"]}
              className="w-full justify-between font-normal"
            >
              <span className={cn(selected.length === 0 && "text-muted-foreground")}>
                {selected.length === 0 ? placeholder : `${selected.length} selected`}
              </span>
              <ChevronsUpDownIcon className="text-muted-foreground" />
            </Button>
          }
        />
        <DropdownMenuContent align="start" className="max-h-72 w-(--anchor-width) overflow-y-auto">
          {options.length === 0 ? (
            <p className="text-muted-foreground px-2 py-3 text-xs">Nothing to choose from.</p>
          ) : (
            options.map((option) => {
              const isSelected = value.includes(option.value)

              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => toggle(option)}
                  disabled={option.locked && isSelected}
                  className="hover:bg-accent flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm disabled:opacity-60"
                >
                  <span className="flex-1 truncate">
                    {option.label}
                    {option.hint ? (
                      <span className="text-muted-foreground ml-1.5 font-mono text-[10px]">
                        {option.hint}
                      </span>
                    ) : null}
                  </span>
                  {isSelected ? <CheckIcon className="size-4 shrink-0" /> : null}
                </button>
              )
            })
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {selected.length > 0 ? (
        <div className="flex flex-wrap gap-1">
          {selected.map((option) => (
            <Badge key={option.value} variant="secondary" className="gap-1 pr-1">
              {option.label}
              {option.locked ? null : (
                <button
                  type="button"
                  onClick={() => toggle(option)}
                  aria-label={`Remove ${option.label}`}
                  className="hover:text-foreground text-muted-foreground"
                >
                  <XIcon className="size-3" />
                </button>
              )}
            </Badge>
          ))}
        </div>
      ) : null}
    </div>
  )
}
