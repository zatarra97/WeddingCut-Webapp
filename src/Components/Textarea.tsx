import React, { forwardRef } from "react"

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
	label?: string
	name: string
	wrapperClass?: string
	error?: {
		message?: string
	}
	rows?: number
	disabled?: boolean
}

const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(({ label, name, wrapperClass, error, rows = 4, disabled, ...rest }, ref) => {
	return (
		<div className={wrapperClass}>
			{label && (
				<label className="form-label" htmlFor={name}>
					{label}
				</label>
			)}
			<textarea
				ref={ref}
				name={name}
				value={rest.value === null ? "" : rest.value}
				disabled={disabled}
				className={`appearance-none border rounded w-full py-2 px-3 leading-tight focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary bg-white form-input ${
					error ? "border-red-500" : "border-gray-300"
				} ${disabled ? "text-gray-500 bg-slate-50 cursor-not-allowed" : ""}`}
				style={
					disabled
						? {
								color: "#6B7280",
								backgroundColor: "#f8fafc",
						  }
						: undefined
				}
				rows={rows}
				{...rest}
			/>
			{error?.message && <p className="text-red-500 text-xs mt-1">{error.message}</p>}
		</div>
	)
})

Textarea.displayName = "Textarea"

export default Textarea
