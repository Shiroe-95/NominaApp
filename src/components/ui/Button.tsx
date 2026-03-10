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
            default: "bg-gradient-to-r from-violet to-violet-dark text-white shadow-[0_0_15px_rgba(124,58,237,0.4)] hover:shadow-[0_0_25px_rgba(124,58,237,0.6)] hover:-translate-y-0.5 border border-white/10 active:scale-[0.98]",
            outline: "glass-panel text-slate-200 hover:bg-white/10 hover:border-violet/50 active:scale-[0.98]",
            ghost: "hover:bg-white/10 text-slate-400 hover:text-white active:scale-[0.98]",
            secondary: "bg-navy-light text-slate-200 hover:bg-navy border border-white/5 shadow-sm active:scale-[0.98]",
            danger: "bg-gradient-to-r from-rose to-rose-dark text-white shadow-[0_0_15px_rgba(225,29,72,0.4)] hover:shadow-[0_0_25px_rgba(225,29,72,0.6)] hover:-translate-y-0.5 border border-white/10 active:scale-[0.98]",
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
                    "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg font-medium transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet/40 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-40",
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
