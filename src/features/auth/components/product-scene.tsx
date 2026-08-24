import {
  CodeIcon,
  GlobeIcon,
  PenLineIcon,
  ServerIcon,
  SmartphoneIcon,
} from "lucide-react"
import { useEffect, useReducer, useState } from "react"

import { StatusChip } from "@/components/common/status-chip"
import { cn } from "@/lib/utils"
import type { TranslationStatus } from "@/types/models"

/**
 * One string, in the languages a real product ships.
 *
 * Arabic is in the list on purpose: it is the one that proves the platform handles
 * right-to-left rather than merely storing it, and a visitor scanning a login page for
 * thirty seconds learns more from watching the panel flip direction than from a bullet
 * point claiming RTL support.
 */
const LANGUAGES = [
  {
    code: "en",
    label: "English",
    native: "English",
    value: "Checkout",
    rtl: false,
  },
  {
    code: "de",
    label: "German",
    native: "Deutsch",
    value: "Zur Kasse",
    rtl: false,
  },
  {
    code: "ja",
    label: "Japanese",
    native: "日本語",
    value: "レジに進む",
    rtl: false,
  },
  {
    code: "fr",
    label: "French",
    native: "Français",
    value: "Passer commande",
    rtl: false,
  },
  {
    code: "es",
    label: "Spanish",
    native: "Español",
    value: "Pagar",
    rtl: false,
  },
  { code: "ar", label: "Arabic", native: "العربية", value: "الدفع", rtl: true },
] as const

/** Where a published string goes. Four, because a real project is never just the website. */
const TARGETS = [
  { icon: GlobeIcon, label: "Web" },
  { icon: SmartphoneIcon, label: "Mobile" },
  { icon: ServerIcon, label: "Backend" },
  { icon: CodeIcon, label: "API" },
] as const

/**
 * The three acts, in order: it is written, it is reviewed, it ships.
 *
 * A timeline rather than a set of independent loops. The panel is telling one story — a
 * translator types a string, a reviewer signs it off, four applications receive it — and
 * animations running on their own timers would show all three at once, which reads as
 * decoration instead of a workflow.
 */
const TIMELINE = [
  { phase: "typing", status: "DRAFT", ms: 2200 },
  { phase: "review", status: "REVIEW", ms: 1300 },
  { phase: "approved", status: "APPROVED", ms: 1300 },
  { phase: "shipping", status: "PUBLISHED", ms: 1900 },
  { phase: "shipped", status: "PUBLISHED", ms: 1700 },
] as const

type Phase = (typeof TIMELINE)[number]["phase"]

const TYPE_SPEED_MS = 70

/**
 * Honours the operating system's "reduce motion" setting.
 *
 * This panel is a looping animation with a typewriter, a colour cycle and travelling
 * pulses — close to a worst case for anyone who set that preference because motion makes
 * them ill. It is also *decorative*: the three claims beside it say the same thing in
 * words, so stopping it costs the reader nothing.
 */
function usePrefersReducedMotion() {
  const [prefers, setPrefers] = useState(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
  )

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)")
    const update = () => setPrefers(query.matches)

    query.addEventListener("change", update)

    return () => query.removeEventListener("change", update)
  }, [])

  return prefers
}

export function ProductScene() {
  const [step, advance] = useReducer((current: number) => current + 1, 0)
  const isStill = usePrefersReducedMotion()

  // One counter drives both: which act we are in, and which language this pass is showing.
  // Deriving them from the same number is what keeps the caption, the chips, the card and
  // the delivery lines from ever disagreeing about what is on screen.
  const stage = TIMELINE[step % TIMELINE.length]
  const language =
    LANGUAGES[Math.floor(step / TIMELINE.length) % LANGUAGES.length]
  const phase: Phase = stage.phase

  useEffect(() => {
    if (isStill) {
      return
    }

    const timer = setTimeout(advance, stage.ms)

    return () => clearTimeout(timer)
  }, [step, stage.ms, isStill])

  // Held on the last frame rather than blanked: a still of the finished story — published,
  // delivered to four applications — says as much as the loop does.
  if (isStill) {
    return (
      <div className="relative w-full">
        <LanguageRail activeCode={LANGUAGES[0].code} />
        <TranslationCard
          language={LANGUAGES[0]}
          phase="shipped"
          status="PUBLISHED"
        />
        <Delivery phase="shipped" />
      </div>
    )
  }

  return (
    <div className="relative w-full">
      <LanguageRail activeCode={language.code} />

      <TranslationCard
        key={language.code}
        language={language}
        phase={phase}
        status={stage.status}
      />

      <Delivery phase={phase} />
    </div>
  )
}

/* -------------------------------------------------------------------------- *
 * Act one — every language, one key
 * -------------------------------------------------------------------------- */

function LanguageRail({ activeCode }: { activeCode: string }) {
  return (
    <div className="mb-5 flex min-h-7 flex-wrap items-center gap-1.5">
      {LANGUAGES.map((item) => {
        const isActive = item.code === activeCode

        return (
          <span
            key={item.code}
            className={cn(
              // 150ms, not 300: the value starts typing the instant the language flips, so a slower
              // crossfade left the rail still highlighting the previous language while the card was
              // already writing the new one — the two disagreeing at exactly the moment a reader
              // looks at them.
              "rounded-full px-2.5 py-1 text-[11px] font-medium transition-all duration-150",
              isActive
                ? "scale-105 bg-primary text-primary-foreground shadow-sm"
                : "bg-background/60 text-muted-foreground ring-1 ring-border ring-inset"
            )}
          >
            {item.native}
          </span>
        )
      })}
    </div>
  )
}

/* -------------------------------------------------------------------------- *
 * Act two — someone writes it, someone signs it off
 * -------------------------------------------------------------------------- */

function TranslationCard({
  language,
  phase,
  status,
}: {
  language: (typeof LANGUAGES)[number]
  phase: Phase
  status: TranslationStatus
}) {
  const typed = useTypewriter(language.value, phase === "typing")
  const isEditing = phase === "typing"

  return (
    <div
      dir={language.rtl ? "rtl" : "ltr"}
      className={cn(
        "relative rounded-2xl border bg-background/80 p-4 shadow-sm backdrop-blur-sm transition-shadow duration-500",
        phase === "shipping" && "shadow-lg ring-1 ring-primary/30"
      )}
    >
      {/* The status rail, exactly as the real grid draws it. */}
      <span
        className={cn(
          "absolute inset-y-4 start-0 w-0.5 rounded-full transition-colors duration-300",
          status === "DRAFT" && "bg-amber-400",
          status === "REVIEW" && "bg-sky-400",
          status === "APPROVED" && "bg-violet-400",
          status === "PUBLISHED" && "bg-emerald-400"
        )}
      />

      <div className="flex items-center justify-between gap-3 ps-3">
        <p className="font-mono text-[11px] text-muted-foreground">
          cart.checkout
        </p>
        <span className="font-mono text-[10px] text-muted-foreground/70">
          {language.label}
        </span>
      </div>

      <p
        dir={language.rtl ? "rtl" : "ltr"}
        className={cn(
          "mt-2 min-h-8 ps-3 text-xl font-medium tracking-tight",
          language.rtl && "text-right"
        )}
      >
        {typed}
        {isEditing ? (
          <span className="ml-0.5 inline-block h-5 w-px translate-y-0.5 animate-pulse bg-foreground align-middle" />
        ) : null}
      </p>

      <div className="mt-3 flex items-center gap-2 ps-3">
        <StatusChip status={status} size="sm" />

        {/* The pen: present while it is being written, gone once it is somebody else's. */}
        <span
          className={cn(
            "flex items-center gap-1 text-[10px] text-muted-foreground transition-opacity duration-200",
            isEditing ? "opacity-100" : "opacity-0"
          )}
        >
          <PenLineIcon className="size-3" />
          Yuki is editing
        </span>

        <span
          className={cn(
            "ms-auto text-[10px] text-muted-foreground transition-opacity duration-200",
            phase === "review" || phase === "approved"
              ? "opacity-100"
              : "opacity-0"
          )}
        >
          Sofia reviewed it
        </span>
      </div>
    </div>
  )
}

/**
 * Reveals the string one character at a time.
 *
 * Counts *code points*, not UTF-16 units — `[...value]` rather than `value.slice`. Half of
 * these languages are outside the BMP or use combining marks, and slicing by index tears a
 * character in two: the animation that exists to show off multilingual support would be
 * the thing rendering it as mojibake.
 */
function useTypewriter(value: string, isActive: boolean) {
  const characters = [...value]
  const total = characters.length
  const [count, setCount] = useState(0)

  // Reset during render rather than in an effect: the same idiom the translations grid
  // uses when a filter change invalidates its page. An effect would paint one frame of the
  // previous language's text under the new language's label first.
  const signature = `${value}|${isActive}`
  const [lastSignature, setLastSignature] = useState(signature)

  if (signature !== lastSignature) {
    setLastSignature(signature)
    setCount(isActive ? 0 : total)
  }

  useEffect(() => {
    if (!isActive) {
      return
    }

    // Bounded by the phase, not by the string: when the act ends `isActive` flips and this
    // effect tears the interval down, so nothing keeps ticking behind a finished line.
    const timer = setInterval(
      () => setCount((current) => Math.min(current + 1, total)),
      TYPE_SPEED_MS
    )

    return () => clearInterval(timer)
  }, [isActive, total])

  return characters.slice(0, count).join("")
}

/* -------------------------------------------------------------------------- *
 * Act three — it reaches the applications
 * -------------------------------------------------------------------------- */

function Delivery({ phase }: { phase: Phase }) {
  const isFlowing = phase === "shipping"
  const hasLanded = phase === "shipping" || phase === "shipped"

  return (
    <div className="relative mt-2">
      {/*
        `preserveAspectRatio="none"` so the fan always meets the four columns below however
        wide the panel gets — the endpoints are fractions of the width, not fixed points.
        The cost is non-uniform scaling, which would smear the stroke widths; every stroke
        below carries `vector-effect="non-scaling-stroke"` to opt back out of that.
      */}
      <svg
        viewBox="0 0 400 64"
        className="h-16 w-full"
        fill="none"
        aria-hidden
        preserveAspectRatio="none"
      >
        {TARGETS.map((target, index) => {
          // Fan out from the card's centre to each target's centre. The columns are even,
          // so the endpoints are the midpoints of four equal slices.
          const endX = 50 + index * 100
          const path = `M 200 0 C 200 34, ${endX} 30, ${endX} 64`

          return (
            <g key={target.label}>
              <path
                d={path}
                stroke="currentColor"
                strokeWidth="1"
                vectorEffect="non-scaling-stroke"
                className="text-border"
              />
              {/*
                `pathLength="1"` normalises the geometry: the four curves are different
                lengths, so a hard-coded dash array hid the short middle ones completely
                and left the long outer ones half-drawn before anything had shipped.
                Declaring every path as one unit long makes the reveal identical on all
                four, and independent of how wide the panel is.
              */}
              <path
                d={path}
                pathLength="1"
                stroke="currentColor"
                strokeWidth="1.75"
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
                className={cn(
                  "text-primary transition-[stroke-dashoffset] duration-1000 ease-out",
                  hasLanded ? "[stroke-dashoffset:0]" : "[stroke-dashoffset:1]"
                )}
                style={{ strokeDasharray: 1 }}
              />
              {/*
                Keyed on the phase so the pulse remounts and replays each cycle. An
                `animateMotion` that has already finished will not restart on its own.
              */}
              {isFlowing ? (
                <circle key={`pulse-${phase}`} r="3" className="fill-primary">
                  <animateMotion
                    dur="1s"
                    begin={`${index * 0.12}s`}
                    fill="freeze"
                    path={path}
                  />
                </circle>
              ) : null}
            </g>
          )
        })}
      </svg>

      <div className="grid grid-cols-4 gap-2">
        {TARGETS.map((target, index) => (
          <div
            key={target.label}
            style={{ transitionDelay: `${index * 110}ms` }}
            className={cn(
              "flex flex-col items-center gap-1 rounded-xl border px-2 py-2.5 transition-all duration-500",
              hasLanded
                ? "border-primary/40 bg-primary/10 text-foreground"
                : "border-border bg-background/50 text-muted-foreground"
            )}
          >
            <target.icon className="size-4" />
            <span className="text-[10px] font-medium">{target.label}</span>
          </div>
        ))}
      </div>

      <p
        className={cn(
          "mt-3 text-center text-[11px] transition-opacity duration-500",
          hasLanded
            ? "text-primary opacity-100"
            : "text-muted-foreground opacity-0"
        )}
      >
        Live in every application — no redeploy
      </p>
    </div>
  )
}
