import Image from "next/image"
import { APP_NAME } from "@/lib/constants"
import { cn } from "@/lib/utils"

const LOGOS = {
  // TAC on its own, for tight spots: the company name is unreadable when small.
  mark: { src: "/logo-mark.png", width: 383, height: 191 },
  full: { src: "/logo.png", width: 432, height: 283 },
}

/**
 * The company logo. `className` sets the height. The artwork is dark maroon on
 * transparent, so the white backing keeps it legible in dark mode.
 */
export function BrandLogo({
  variant = "mark",
  className,
}: {
  variant?: keyof typeof LOGOS
  className?: string
}) {
  return (
    <Image
      {...LOGOS[variant]}
      alt={`${APP_NAME} logo`}
      loading="eager"
      className={cn("w-auto rounded-md bg-white object-contain p-0.5", className)}
    />
  )
}
