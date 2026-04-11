import React from "react"
import ReactSelect from "react-select"

interface Option {
	value: string | number
	label: string
}

interface SelectProps {
	label?: string
	name: string
	value?: string | number | null
	onChange: (event: { target: { name: string; value: string | number | null } }) => void
	onBlur?: (event: React.FocusEvent<HTMLInputElement>) => void
	options: Option[]
	error?: { message: string }
	placeholder?: string
	disabled?: boolean
	isClearable?: boolean
	isSearchable?: boolean
	colorScheme?: "violet" | "brown"
}

const CustomSelect = React.forwardRef<any, SelectProps>(({ label, name, value, onChange, onBlur, options, error, placeholder, disabled, isClearable = true, isSearchable = true, colorScheme = "violet" }, ref) => {
	const focusColor = colorScheme === "brown" ? "#7c3aed" : "#7c3aed"
	const focusLight = colorScheme === "brown" ? "#ede9fe" : "#ede9fe"
	const activeColor = colorScheme === "brown" ? "#6d28d9" : "#8b5cf6"

	const selectedOption = options.find((option) => {
		return String(option.value) === String(value)
	})

	const handleChange = (selectedOption: Option | null) => {
		const originalValue = selectedOption ? selectedOption.value : null
		onChange({
			target: {
				name,
				value: originalValue,
			},
		})
	}

	return (
		<div className="">
			{label && <label className="form-label">{label}</label>}
			<ReactSelect
				ref={ref}
				name={name}
				value={selectedOption}
				onChange={handleChange}
				onBlur={onBlur}
				options={options}
				placeholder={placeholder}
				isClearable={isClearable}
				isSearchable={isSearchable}
				isDisabled={disabled}
				menuPortalTarget={typeof document !== "undefined" ? document.body : undefined}
				menuPosition="fixed"
				className="form-input"
				styles={{
					control: (baseStyles, state) => ({
						...baseStyles,
						borderColor: error ? "red" : state.isFocused ? focusColor : "#d1d5db",
						boxShadow: state.isFocused ? `0 0 0 1px ${focusColor}` : "none",
						opacity: disabled ? 1 : 1,
						color: disabled ? "#6B7280" : "#374151",
						backgroundColor: disabled ? "#f8fafc" : "white",
						"&:hover": {
							borderColor: state.isFocused ? focusColor : "#d1d5db",
						},
						fontSize: "form-input",
					}),
					menuPortal: (base) => ({
						...base,
						zIndex: 999999,
					}),
					menu: (base) => ({
						...base,
						zIndex: 999999,
					}),
					option: (baseStyles, state) => ({
						...baseStyles,
						backgroundColor: state.isSelected ? focusColor : state.isFocused ? focusLight : "white",
						color: state.isSelected ? "white" : "#374151",
						"&:active": { backgroundColor: activeColor },
					}),
					singleValue: (baseStyles) => ({
						...baseStyles,
						color: disabled ? "#909090" : "#374151",
					}),
					placeholder: (baseStyles) => ({
						...baseStyles,
						color: disabled ? "#909090" : "#6b7280",
					}),
				}}
			/>
			{error && <p className="text-red-500 text-xs mt-1">{error.message}</p>}
		</div>
	)
})

CustomSelect.displayName = "CustomSelect"

export default CustomSelect
