import { InputHTMLAttributes, forwardRef } from "react"

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
	label?: string
	error?: {
		message?: string
	}
	info?: string
}

const Input = forwardRef<HTMLInputElement, InputProps>(({ label, type = "text", name, error, value, info, disabled, ...rest }, ref) => {
	// Gestisce l'evento wheel per prevenire il cambiamento dei valori negli input numerici
	const handleWheel = (e: React.WheelEvent<HTMLInputElement>) => {
		if (type === "number") {
			e.currentTarget.blur()
		}
	}

	return (
		<div className="">
			{label && (
				<label className="form-label" htmlFor={name}>
					<div className="flex items-center gap-2">
						{label}
						{info && (
							<div className="relative group">
								<i className="fa-solid fa-circle-info text-gray-400 hover:text-gray-600 text-sm cursor-help"></i>
								<div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 hidden group-hover:block w-48 p-2 bg-gray-800 text-white text-sm rounded shadow-lg z-50">
									{info}
									<div className="absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-gray-800"></div>
								</div>
							</div>
						)}
					</div>
				</label>
			)}
			<input
				type={type}
				name={name}
				id={name}
				ref={ref}
				value={value === null ? "" : value}
				onWheel={handleWheel}
				disabled={disabled}
				className={`appearance-none border rounded w-full py-2 px-3 leading-tight focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary bg-white form-input ${
					error ? "border-red-500 focus:ring-1" : "border-gray-300"
				} ${disabled ? " text-gray-900 bg-slate-50 cursor-not-allowed" : ""}`}
				style={
					disabled
						? {
								color: "#6B7280",
								backgroundColor: "#f8fafc",
						  }
						: undefined
				}
				{...rest}
			/>
			{error && error.message && <p className="text-red-500 text-xs mt-1">{error.message}</p>}
		</div>
	)
})

Input.displayName = "Input"

export default Input
