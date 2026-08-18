import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { initials } from "@/lib/format"
import { cn } from "@/lib/utils"
import type { User } from "@/types/models"

interface UserAvatarProps {
  user: Pick<User, "firstName" | "lastName" | "avatar"> | undefined
  className?: string
}

/** Avatar with initials fallback — users often have no uploaded image. */
export function UserAvatar({ user, className }: UserAvatarProps) {
  return (
    <Avatar className={cn("size-7", className)}>
      {user?.avatar ? <AvatarImage src={user.avatar} alt="" /> : null}
      <AvatarFallback className="text-[11px] font-semibold">
        {initials(user?.firstName, user?.lastName)}
      </AvatarFallback>
    </Avatar>
  )
}
