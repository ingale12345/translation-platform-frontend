import { zodResolver } from "@hookform/resolvers/zod"
import { GlobeIcon, Loader2Icon } from "lucide-react"
import { useForm } from "react-hook-form"
import { z } from "zod"

import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { env } from "@/config/env"
import { useLogin } from "@/features/session/hooks"
import { errorMessage } from "@/lib/http/errors"

const schema = z.object({
  email: z.email("Enter a valid email address"),
  password: z.string().min(1, "Password is required"),
})

type LoginForm = z.infer<typeof schema>

/**
 * Sign-in.
 *
 * Client validation only catches shape — the server owns the credential check, so a
 * rejected login surfaces the API's own message rather than a guess about which field
 * was wrong. Telling the user *which* of email or password was incorrect would also hand
 * an attacker a way to enumerate accounts.
 */
export function LoginPage() {
  const login = useLogin()

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginForm>({
    resolver: zodResolver(schema),
    defaultValues: { email: "", password: "" },
  })

  const onSubmit = handleSubmit((values) => login.mutate(values))

  return (
    <div className="grid min-h-svh place-items-center p-6">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex items-center gap-2.5">
          <div className="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <GlobeIcon className="size-4.5" />
          </div>
          <div>
            <p className="text-sm font-semibold">{env.appName}</p>
            <p className="text-[11px] text-muted-foreground">
              Translation Platform
            </p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Sign in</CardTitle>
            <CardDescription>
              Use your platform account to continue.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={onSubmit} className="space-y-4" noValidate>
              {login.error ? (
                <Alert variant="destructive">
                  <AlertDescription>
                    {errorMessage(login.error)}
                  </AlertDescription>
                </Alert>
              ) : null}

              <div className="space-y-1.5">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  autoFocus
                  aria-invalid={Boolean(errors.email)}
                  {...register("email")}
                />
                {errors.email ? (
                  <p className="text-xs text-destructive">
                    {errors.email.message}
                  </p>
                ) : null}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  aria-invalid={Boolean(errors.password)}
                  {...register("password")}
                />
                {errors.password ? (
                  <p className="text-xs text-destructive">
                    {errors.password.message}
                  </p>
                ) : null}
              </div>

              <Button
                type="submit"
                className="w-full"
                disabled={login.isPending}
              >
                {login.isPending ? (
                  <Loader2Icon className="animate-spin" />
                ) : null}
                Sign in
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
