"use client"

import { useTheme } from "next-themes"
import { Toaster as Sonner, ToasterProps } from "sonner"

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme()

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      position="bottom-right"
      expand={false}
      visibleToasts={5}
      closeButton={false}
      richColors={false}
      duration={3000}
      gap={8}
      style={
        {
          "--normal-bg": "hsl(var(--background))",
          "--normal-border": "hsl(var(--border))",
          "--normal-text": "hsl(var(--foreground))",
          "--success-bg": "hsl(var(--background))",
          "--success-border": "hsl(var(--border))",
          "--success-text": "hsl(var(--foreground))",
        } as React.CSSProperties
      }
      {...props}
    />
  )
}

export { Toaster }
