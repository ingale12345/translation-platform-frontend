import { SearchIcon, XIcon } from "lucide-react"
import { useEffect, useState } from "react"

import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

interface SearchInputProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  /** Milliseconds to wait after typing stops. `0` reports every keystroke. */
  debounceMs?: number
  className?: string
}

/**
 * A search box that debounces before reporting up.
 *
 * The input keeps its own immediate state so typing never feels laggy, and only the
 * committed value reaches the query layer — otherwise every keystroke would be a request
 * and a new cache entry.
 */
export function SearchInput({
  value,
  onChange,
  placeholder = "Search…",
  debounceMs = 300,
  className,
}: SearchInputProps) {
  const [draft, setDraft] = useState(value)
  const [lastValue, setLastValue] = useState(value)

  // Keeps the box in step when the value is reset from outside (e.g. "clear filters").
  // Adjusted during render rather than in an effect: an effect would paint the stale text
  // for one frame first, and React re-runs this pass before committing anything.
  if (value !== lastValue) {
    setLastValue(value)
    setDraft(value)
  }

  useEffect(() => {
    if (draft === value) {
      return
    }

    const timer = setTimeout(() => onChange(draft), debounceMs)

    return () => clearTimeout(timer)
  }, [draft, value, debounceMs, onChange])

  return (
    <div className={cn("relative", className)}>
      <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        placeholder={placeholder}
        className="pr-8 pl-8"
        aria-label={placeholder}
      />
      {draft ? (
        <button
          type="button"
          onClick={() => setDraft("")}
          aria-label="Clear search"
          className="absolute top-1/2 right-2 -translate-y-1/2 rounded-sm text-muted-foreground hover:text-foreground"
        >
          <XIcon className="size-4" />
        </button>
      ) : null}
    </div>
  )
}
