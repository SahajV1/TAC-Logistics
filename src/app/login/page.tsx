import { Truck } from "lucide-react"
import { LoginForm } from "./login-form"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { APP_FULL_NAME } from "@/lib/constants"

export const metadata = { title: "Sign in" }

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ redirect?: string }>
}) {
  const { redirect } = await searchParams
  const redirectTo =
    redirect && redirect.startsWith("/") ? redirect : "/"

  return (
    <div className="flex min-h-dvh items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="flex flex-col items-center gap-2 text-center">
          <div className="bg-primary text-primary-foreground flex size-12 items-center justify-center rounded-xl">
            <Truck className="size-6" />
          </div>
          <h1 className="text-xl font-semibold tracking-tight">
            {APP_FULL_NAME}
          </h1>
          <p className="text-muted-foreground text-sm">
            Sign in to manage your branch operations
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Welcome back</CardTitle>
            <CardDescription>
              Enter your credentials to continue
            </CardDescription>
          </CardHeader>
          <CardContent>
            <LoginForm redirectTo={redirectTo} />
          </CardContent>
        </Card>

        <p className="text-muted-foreground text-center text-xs">
          Lucknow &amp; Ghaziabad branches · Authorized staff only
        </p>
      </div>
    </div>
  )
}
