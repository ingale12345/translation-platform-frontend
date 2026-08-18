import {
  ArrowRightIcon,
  CheckCircle2Icon,
  EyeIcon,
  EyeOffIcon,
  GlobeIcon,
  Loader2Icon,
  LockIcon,
  MailIcon,
} from "lucide-react"
import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"

import { useAppNavigate } from "@/lib/navigate"
import { FormField } from "@/components/common/form-field"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { env } from "@/config/env"
import { useLogin } from "@/features/session/hooks"
import { errorMessage } from "@/lib/http/errors"

const schema = z.object({
  email: z.email("Enter a valid email address"),
  password: z.string().min(1, "Password is required"),
})

type LoginForm = z.infer<typeof schema>

const HIGHLIGHTS = [
  "One grid for every key, language and application",
  "Review and publish workflow with a full audit trail",
  "Runtime translation delivery — no redeploy to ship a fix",
]

/**
 * Sign-in.
 *
 * Client validation catches shape only; the server owns the credential check, so a
 * rejected login surfaces the API's own message rather than a guess about which field was
 * wrong. Saying *which* of email or password was incorrect would also hand an attacker a
 * way to enumerate accounts.
 */
export function LoginPage() {
  const login = useLogin()
  const navigate = useAppNavigate()
  const [showPassword, setShowPassword] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginForm>({
    resolver: zodResolver(schema),
    defaultValues: { email: "", password: "" },
  })

  const onSubmit = handleSubmit((values) =>
    login.mutate(values, {
      // The route guard only runs on navigation, so signing in has to move the user
      // itself. Without this the form sits on a successful response until something else
      // triggers a route change.
      onSuccess: () => navigate("/dashboard"),
    })
  )

  return (
    <div className="grid min-h-svh lg:grid-cols-[1fr_1.1fr]">
      <div className="flex flex-col justify-center px-6 py-12 sm:px-12 lg:px-16">
        <div className="mx-auto w-full max-w-sm">
          <div className="mb-8 flex items-center gap-2.5">
            <div className="flex size-10 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <GlobeIcon className="size-5" />
            </div>
            <div>
              <p className="text-sm font-semibold">{env.appName}</p>
              <p className="text-[11px] text-muted-foreground">
                Translation Platform
              </p>
            </div>
          </div>

          <h1 className="text-2xl font-semibold tracking-tight">
            Welcome back
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Sign in to continue to your projects.
          </p>

          <form onSubmit={onSubmit} className="mt-8 space-y-4" noValidate>
            {login.error ? (
              <Alert variant="destructive">
                <AlertDescription>{errorMessage(login.error)}</AlertDescription>
              </Alert>
            ) : null}

            <FormField label="Email" required error={errors.email?.message}>
              {(props) => (
                <div className="relative">
                  <MailIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    {...props}
                    type="email"
                    autoComplete="email"
                    placeholder="you@company.com"
                    autoFocus
                    className="pl-8"
                    {...register("email")}
                  />
                </div>
              )}
            </FormField>

            <FormField
              label="Password"
              required
              error={errors.password?.message}
            >
              {(props) => (
                <div className="relative">
                  <LockIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    {...props}
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    placeholder="••••••••"
                    className="pr-9 pl-8"
                    {...register("password")}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((value) => !value)}
                    aria-label={
                      showPassword ? "Hide password" : "Show password"
                    }
                    className="absolute top-1/2 right-2 -translate-y-1/2 rounded-sm p-0.5 text-muted-foreground hover:text-foreground"
                  >
                    {showPassword ? (
                      <EyeOffIcon className="size-4" />
                    ) : (
                      <EyeIcon className="size-4" />
                    )}
                  </button>
                </div>
              )}
            </FormField>

            <Button
              type="submit"
              size="lg"
              className="w-full"
              disabled={login.isPending}
            >
              {login.isPending ? (
                <>
                  <Loader2Icon className="animate-spin" /> Signing in…
                </>
              ) : (
                <>
                  Sign in <ArrowRightIcon />
                </>
              )}
            </Button>
          </form>

          <p className="mt-6 text-center text-xs text-muted-foreground">
            Access is granted per project. If you cannot sign in, ask a project
            admin to invite you.
          </p>
        </div>
      </div>

      {/* Decorative panel — hidden on small screens, where the form is the whole job. */}
      <div
        className="relative hidden overflow-hidden bg-muted/40 lg:flex lg:flex-col lg:justify-center lg:px-16"
        aria-hidden
      >
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,var(--color-primary)/8%,transparent_55%),radial-gradient(circle_at_80%_70%,var(--color-primary)/6%,transparent_45%)]" />

        <div className="relative max-w-md">
          <p className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
            Localization Management
          </p>
          <p className="mt-3 text-2xl leading-snug font-semibold tracking-tight">
            Every string your product speaks, in one place.
          </p>

          <ul className="mt-8 space-y-3">
            {HIGHLIGHTS.map((highlight) => (
              <li key={highlight} className="flex items-start gap-2.5 text-sm">
                <CheckCircle2Icon className="mt-0.5 size-4 shrink-0 text-primary" />
                <span className="text-muted-foreground">{highlight}</span>
              </li>
            ))}
          </ul>

          <div className="mt-10 grid max-w-xs grid-cols-3 gap-3">
            {[
              { label: "Missing", tone: "bg-zinc-300 dark:bg-zinc-700" },
              { label: "Review", tone: "bg-sky-400" },
              { label: "Published", tone: "bg-emerald-400" },
            ].map((step) => (
              <div key={step.label} className="space-y-1.5">
                <div className={`h-1 rounded-full ${step.tone}`} />
                <p className="text-[11px] text-muted-foreground">
                  {step.label}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
