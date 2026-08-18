import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"

export interface SelectOption {
  value: string
  label: string
  /** Secondary text shown after the label in the list, e.g. a code or a count. */
  hint?: string
  disabled?: boolean
}

interface SelectFieldProps {
  options: SelectOption[]
  value: string | null | undefined
  onChange: (value: string) => void
  placeholder?: string
  id?: string
  "aria-invalid"?: boolean
  disabled?: boolean
  className?: string
}

/**
 * A select that shows the option's **label**, not its value.
 *
 * Base UI's `Select.Value` renders the raw value unless it is told how to format it, so a
 * select over records shows a database id in the closed trigger. Every select in the
 * console goes through here so that cannot happen once, let alone repeatedly.
 */
export function SelectField({
  options,
  value,
  onChange,
  placeholder = "Select…",
  id,
  disabled,
  className,
  ...aria
}: SelectFieldProps) {
  const labels = Object.fromEntries(
    options.map((option) => [option.value, option.label])
  )

  return (
    <Select
      // `null`, not `undefined`: an undefined value makes Base UI treat the select as
      // uncontrolled, and it then stops reflecting resets from outside.
      value={value ?? null}
      onValueChange={(next) => next !== null && onChange(String(next))}
      disabled={disabled}
    >
      <SelectTrigger
        id={id}
        aria-invalid={aria["aria-invalid"]}
        className={cn("w-full", className)}
      >
        <SelectValue placeholder={placeholder}>
          {(selected: unknown) =>
            selected == null || selected === ""
              ? placeholder
              : (labels[String(selected)] ?? placeholder)
          }
        </SelectValue>
      </SelectTrigger>

      <SelectContent>
        {options.map((option) => (
          <SelectItem
            key={option.value}
            value={option.value}
            disabled={option.disabled}
          >
            <span className="flex min-w-0 flex-1 items-center gap-2">
              <span className="truncate">{option.label}</span>
              {option.hint ? (
                <span className="shrink-0 font-mono text-[10px] text-muted-foreground">
                  {option.hint}
                </span>
              ) : null}
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
