import * as React from "react"
import { cn } from "@/lib/utils"
import { Slot } from "@radix-ui/react-slot"

export interface ButtonProps
    extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    asChild?: boolean
    variant?: 'default' | 'outline' | 'ghost' | 'secondary' | 'danger'
    size?: 'default' | 'sm' | 'lg' | 'icon'
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
    ({ className, variant = "default", size = "default", asChild = false, ...props }, ref) => {
        const Comp = asChild ? Slot : "button"

        const variantClasses = {
            default: "bg-[#7C3AED] text-white shadow-[0_0_20px_rgba(124,58,237,0.3)] hover:shadow-[0_0_30px_rgba(124,58,237,0.5)] hover:-translate-y-0.5 active:scale-[0.98]",
            outline: "bg-[#1c1f2a] text-[#ccc3d8] hover:bg-[#262a35] hover:text-white active:scale-[0.98]",
            ghost: "hover:bg-white/[0.06] text-[#958da1] hover:text-white active:scale-[0.98]",
            secondary: "bg-[#181b26] text-[#ccc3d8] hover:bg-[#1c1f2a] active:scale-[0.98]",
            danger: "bg-[#E11D48] text-white shadow-[0_0_20px_rgba(225,29,72,0.3)] hover:shadow-[0_0_30px_rgba(225,29,72,0.5)] hover:-translate-y-0.5 active:scale-[0.98]",
        }

        const sizeClasses = {
            default: "h-9 px-4 py-2 text-sm",
            sm: "h-8 rounded-lg px-3 text-xs",
            lg: "h-11 rounded-xl px-6 text-sm",
            icon: "h-9 w-9",
        }

        return (
            <Comp
                className={cn(
                    "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl font-semibold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7C3AED]/40 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-40",
                    variantClasses[variant],
                    sizeClasses[size],
                    className
                )}
                ref={ref}
                {...props}
            />
        )
    }
)
Button.displayName = "Button"

export { Button }
