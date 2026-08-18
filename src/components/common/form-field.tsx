import { useId } from "react"
import type { ReactNode } from "react"

import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"

interface FormFieldProps {
  label: string
  /** Rendered under the control when there is no error. */
  hint?: string
  error?: string
  required?: boolean
  className?: string
  /** Receives the id to put on the control, so the label actually points at it. */
  children: (props: { id: string; "aria-invalid": boolean }) => ReactNode
}

/**
 * Label + control + error, with the wiring done once.
 *
 * The `id` is generated here and handed to the control, because a label that is not
 * associated with its input is invisible to a screen reader and does not focus the field
 * on click — both easy to forget, and neither shows up in review.
 *
 * `hint` disappears while an error is showing: stacking both makes the error easy to miss.
 */
export function FormField({
  label,
  hint,
  error,
  required,
  className,
  children,
}: FormFieldProps) {
  const id = useId()

  return (
    <div className={cn("space-y-1.5", className)}>
      <Label htmlFor={id} className="flex items-center gap-1">
        {label}
        {required ? (
          <span className="text-destructive" aria-hidden>
            *
          </span>
        ) : null}
      </Label>

      {children({ id, "aria-invalid": Boolean(error) })}

      {error ? (
        <p className="text-destructive text-xs">{error}</p>
      ) : hint ? (
        <p className="text-muted-foreground text-xs">{hint}</p>
      ) : null}
    </div>
  )
}
