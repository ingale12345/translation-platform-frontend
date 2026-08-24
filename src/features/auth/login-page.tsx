import {
  ArrowRightIcon,
  EyeIcon,
  EyeOffIcon,
  GitBranchIcon,
  GlobeIcon,
  Loader2Icon,
  LockIcon,
  MailIcon,
  ShieldCheckIcon,
  ZapIcon,
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
import { ProductScene } from "./components/product-scene"

const schema = z.object({
  email: z.email("Enter a valid email address"),
  password: z.string().min(1, "Password is required"),
})

type LoginForm = z.infer<typeof schema>

/**
 * Three claims, each one a thing the panel beside them visibly does.
 *
 * Kept to three and phrased as outcomes rather than features: somebody reading a login
 * page is deciding whether this is the tool their team was told about, not evaluating a
 * feature matrix.
 */
const HIGHLIGHTS = [
  {
    icon: GlobeIcon,
    title: "Every language, one grid",
    body: "Keys down the side, locales across the top — including right-to-left.",
  },
  {
    icon: ShieldCheckIcon,
    title: "Nothing ships unreviewed",
    body: "Draft to review to approved to published, with who changed what on record.",
  },
  {
    icon: ZapIcon,
    title: "Fix copy without a release",
    body: "Applications fetch their strings at runtime through a scoped API token.",
  },
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
    <div className="grid min-h-svh md:grid-cols-2">
      <div className="flex flex-col justify-center overflow-y-auto px-6 py-12 sm:px-8 lg:px-12 xl:px-16">
        <div className="mx-auto my-auto w-full max-w-lg">
          <div className="mb-10 flex items-center gap-3">
            <div className="flex size-11 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-sm">
              <GlobeIcon className="size-5.5" />
            </div>
            <div className="leading-tight">
              <p className="text-[15px] font-semibold tracking-tight">
                {env.appName}
              </p>
              <p className="text-[11px] text-muted-foreground">
                Translation Platform
              </p>
            </div>
          </div>

          <h1 className="text-[28px] leading-tight font-semibold tracking-tight">
            Welcome back
          </h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Sign in to continue to your projects.
          </p>

          {/*
            The one-line version of the panel, for the screens that do not get the panel.
            Below `lg` a visitor otherwise sees a bare form with no idea what it belongs to.
          */}
          <p className="mt-4 text-xs leading-relaxed text-muted-foreground md:hidden">
            Manage every string your product speaks — one grid for all your
            languages and applications, a review workflow before anything ships,
            and runtime delivery so a copy fix needs no release.
          </p>

          <form onSubmit={onSubmit} className="mt-8 space-y-5" noValidate>
            {login.error ? (
              <Alert variant="destructive">
                <AlertDescription>{errorMessage(login.error)}</AlertDescription>
              </Alert>
            ) : null}

            <FormField label="Email" required error={errors.email?.message}>
              {(props) => (
                <div className="relative">
                  <MailIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    {...props}
                    type="email"
                    autoComplete="email"
                    placeholder="you@company.com"
                    autoFocus
                    className="h-11 pl-9"
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
                  <LockIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    {...props}
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    placeholder="••••••••"
                    className="h-11 pr-10 pl-9"
                    {...register("password")}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((value) => !value)}
                    aria-label={
                      showPassword ? "Hide password" : "Show password"
                    }
                    className="absolute top-1/2 right-2.5 -translate-y-1/2 rounded-md p-1 text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
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
              className="h-11 w-full"
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

          <div className="mt-8 border-t pt-5">
            <p className="text-center text-xs leading-relaxed text-muted-foreground">
              Access is granted per project. If you cannot sign in, ask a
              platform admin to create your account — there is no self-service
              sign-up.
            </p>
          </div>
        </div>
      </div>

      {/*
        The product, demonstrated rather than described.
        Hidden below `lg`, where the form is the entire job and a story panel would push
        the password field off the fold.
      */}
      <div className="relative hidden overflow-x-hidden overflow-y-auto border-l bg-muted/30 md:flex md:flex-col md:justify-center md:px-8 md:py-10 lg:px-12 xl:px-16">
        <div
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_25%_15%,var(--color-primary)/10%,transparent_55%),radial-gradient(circle_at_85%_80%,var(--color-primary)/8%,transparent_50%)]"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute inset-0 [background-image:linear-gradient(to_right,var(--color-border)_1px,transparent_1px),linear-gradient(to_bottom,var(--color-border)_1px,transparent_1px)] [mask-image:radial-gradient(ellipse_at_center,black,transparent_75%)] [background-size:44px_44px] opacity-[0.35]"
          aria-hidden
        />

        {/*
          `mx-auto`: the panel grows with the viewport but the content has a readable
          maximum, so without this the slack all collected on the right and the page looked
          lopsided on anything wider than a laptop.
        */}
        <div className="relative mx-auto my-auto w-full max-w-lg">
          <p className="text-[11px] font-semibold tracking-[0.14em] text-primary uppercase">
            Localization Management
          </p>
          <h2 className="mt-3 text-3xl leading-[1.15] font-semibold tracking-tight text-balance">
            One string, written once — everywhere your product speaks it.
          </h2>

          {/*
            `aria-hidden`: the scene is a loop of the same three sentences the list below
            already states. A screen reader announcing a status chip changing every second
            would be noise, not information.
          */}
          <div className="mt-8" aria-hidden>
            <ProductScene />
          </div>

          <ul className="mt-10 grid gap-5 lg:grid-cols-3">
            {HIGHLIGHTS.map((highlight) => (
              <li key={highlight.title}>
                <highlight.icon className="size-4 text-primary" />
                <p className="mt-2 text-[13px] font-medium">
                  {highlight.title}
                </p>
                <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">
                  {highlight.body}
                </p>
              </li>
            ))}
          </ul>

          <p className="mt-8 flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <GitBranchIcon className="size-3.5" />
            Imports reconcile against your code — removed keys are disabled,
            never deleted.
          </p>
        </div>
      </div>
    </div>
  )
}
