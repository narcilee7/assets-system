import { cloneElement, isValidElement,forwardRef, type ButtonHTMLAttributes , type ReactNode} from "react";


type Variant = 
| "default"
| "secondary"
| "outline"
| "destructive"
| "ghost"
| "link"

type Size  =
| "sm"
| "md"
| "lg"
| "icon"

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: Variant
    size?: Size
    loading?: boolean
    disabled?: boolean
    leftIcon?: ReactNode
    rightIcon?: ReactNode
    children?: ReactNode
    asChild?: boolean
}

const base =
  `
inline-flex
items-center
justify-center
gap-2

rounded-md

font-medium

transition-colors

focus-visible:outline-none
focus-visible:ring-2
focus-visible:ring-blue-500

disabled:pointer-events-none
disabled:opacity-50
`;

const variants: Record<Variant, string> = {
  default:
    "bg-blue-600 text-white hover:bg-blue-700",

  secondary:
    "bg-gray-100 text-gray-900 hover:bg-gray-200",

  outline:
    "border border-gray-300 hover:bg-gray-100",

  destructive:
    "bg-red-600 text-white hover:bg-red-700",

  ghost:
    "hover:bg-gray-100",

  link:
    "text-blue-600 underline-offset-4 hover:underline",
};

const sizes: Record<Size, string> = {
  sm: "h-8 px-3 text-sm",

  md: "h-10 px-4",

  lg: "h-12 px-6 text-base",

  icon: "h-10 w-10",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>((props, ref) => {
  const { variant = "default", size = "md", disabled = false, loading = false, children, leftIcon, rightIcon = null, ...rest } = props;

  return (
    <button ref={ref} disabled={disabled || loading} {...rest}>
        {loading ? <div className="animate-spin h-4 w-4 border border-gray-300 rounded-full"></div> : 
            <>
            {leftIcon}
            {children}
            {rightIcon}
            </>
        }
    </button>
  )
})

Button.displayName = "Button"
