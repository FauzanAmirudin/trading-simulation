"use client"

import { useTheme } from "next-themes"
import { usePathname } from "next/navigation"
import { Toaster as Sonner, type ToasterProps } from "sonner"
import { CircleCheckIcon, InfoIcon, TriangleAlertIcon, OctagonXIcon, Loader2Icon } from "lucide-react"

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme()

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      position="top-center"
      visibleToasts={1}
      duration={2600}
      icons={{
        success: <CircleCheckIcon className="size-4 text-emerald-500" />,
        info: <InfoIcon className="size-4 text-sky-500" />,
        warning: <TriangleAlertIcon className="size-4 text-amber-500" />,
        error: <OctagonXIcon className="size-4 text-rose-500" />,
        loading: <Loader2Icon className="size-4 animate-spin text-primary" />,
      }}
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
          "--border-radius": "1rem",
        } as React.CSSProperties
      }
      toastOptions={{
        classNames: {
          toast:
            "group toast font-sans text-xs font-semibold rounded-2xl border border-border/80 bg-background/95 backdrop-blur-xl shadow-xl shadow-black/5 dark:shadow-black/20 text-foreground py-3 px-4 flex items-center gap-2.5",
          title: "font-semibold text-xs text-foreground",
          description: "text-[11px] text-muted-foreground",
          actionButton: "bg-primary text-primary-foreground text-xs rounded-xl font-bold",
          cancelButton: "bg-muted text-muted-foreground text-xs rounded-xl",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
