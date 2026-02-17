import React, { ReactNode, useState } from "react"

interface FormSectionProps {
	title: string
	children: ReactNode
	className?: string
	defaultOpen?: boolean
}

const FormSection: React.FC<FormSectionProps> = ({ title, children, className = "", defaultOpen = true }) => {
	const [isOpen, setIsOpen] = useState(defaultOpen)

	const toggleSection = () => {
		setIsOpen(!isOpen)
	}

	return (
		<div className={`relative mt-10 mb-15 form-section-dropdown-fix ${className}`} style={{}}>
			<div
				className={`absolute -top-9 bg-white px-4 border-t border-l border-r border-gray-200 rounded-t-lg pt-1 ${
					isOpen ? "" : "border-b rounded-b-lg pb-1 w-full"
				}`}
			>
				<div className="flex items-center justify-between">
					<h2
						className={`text-base md:text-lg font-semibold text-blue-700 ${
							!isOpen ? "cursor-pointer hover:text-blue-800 transition-colors duration-200" : ""
						}`}
						onClick={!isOpen ? toggleSection : undefined}
					>
						{title}
					</h2>
					<button
						type="button"
						onClick={toggleSection}
						className="ml-4 p-1 text-gray-500 hover:text-blue-600 rounded-lg transition-all duration-200 focus:outline-none focus:ring-none focus:ring-none cursor-pointer"
						aria-label={isOpen ? "Chiudi sezione" : "Apri sezione"}
					>
						<i
							className={`fas fa-chevron-down text-sm transition-transform duration-300 ease-in-out ${
								isOpen ? "rotate-0" : "-rotate-90"
							}`}
						></i>
					</button>
				</div>
			</div>
			<div className={`bg-white rounded-b-lg rounded-r-lg ${isOpen ? "border-b-0 shadow-sm border border-gray-200" : "overflow-hidden"}`}>
				<div
					className={`transition-all duration-200 ease-in-out ${
						isOpen ? "max-h-screen opacity-100 p-3 md:p-6 pt-8 overflow-visible" : "max-h-0 opacity-0 p-0 pt-0 overflow-hidden"
					}`}
				>
					{children}
				</div>
			</div>
		</div>
	)
}

export default FormSection
