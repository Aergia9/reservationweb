"use client"

import { Toaster as Sonner, ToasterProps } from "sonner"

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      theme="light"
      className="toaster group"
      style={
        {
          "--normal-bg": "white",
          "--normal-text": "#0f0f0f", // Dark text color
          "--normal-border": "#e5e7eb", // Light gray border
          "--success-bg": "#f0f9ff", // Light blue background for success
          "--success-text": "#0c4a6e", // Dark blue text for success
          "--error-bg": "#fef2f2", // Light red background for error
          "--error-text": "#991b1b", // Dark red text for error
          "--info-bg": "#f8fafc", // Light gray background for info
          "--info-text": "#374151", // Dark gray text for info
        } as React.CSSProperties
      }
      toastOptions={{
        style: {
          background: 'white',
          color: '#0f0f0f',
          border: '1px solid #e5e7eb',
        },
        className: 'my-toast',
      }}
      {...props}
    />
  )
}

export { Toaster }