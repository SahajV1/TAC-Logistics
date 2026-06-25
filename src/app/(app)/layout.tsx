import { requireUser } from "@/lib/auth"
import { AppShell } from "@/components/app-shell"

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const user = await requireUser()

  return (
    <AppShell
      user={{
        isAdmin: user.isAdmin,
        name: user.full_name,
        email: user.email,
        role: user.role,
        branchName: user.branchName,
      }}
    >
      {children}
    </AppShell>
  )
}
