import React from "react"
import { useNavigate } from "react-router-dom"

interface Button {
	label: string
	icon?: string
	onClick: () => void
	variant?: "primary" | "secondary" | "secondary-wire" | "danger" | "csv"
	className?: string
	disabled?: boolean
	loading?: boolean
}

interface PageHeaderProps {
	icon: string
	title: string
	subtitle?: string
	buttons?: Button[]
	className?: string
	backButton?: {
		route?: string
		onClick?: () => void
	}
}

const PageHeader: React.FC<PageHeaderProps> = ({ icon, title, subtitle, buttons = [], className = "", backButton }) => {
	const navigate = useNavigate()

	const handleBack = () => {
		if (backButton) {
			if (backButton.onClick) {
				backButton.onClick()
			} else if (backButton.route) {
				navigate(backButton.route)
			}
		}
	}

	return (
		<div className={`relative overflow-hidden bg-linear-to-r from-slate-100 to-slate-50 py-4 shadow-sm border-b border-slate-200 ${className}`}>
			<div className="container flex flex-col md:flex-row items-start md:items-center justify-between px-4">
				<div className="flex items-center space-x-2 md:space-x-4">
					{backButton ? (
						<button
							onClick={handleBack}
							className="flex items-center justify-center w-10 h-10 md:w-12 md:h-12 bg-primary rounded-lg shadow-md hover:bg-primary-dark transition-colors duration-200 cursor-pointer"
						>
							<i className="fa-solid fa-arrow-left text-white text-lg md:text-xl"></i>
						</button>
					) : (
						<div className="flex items-center justify-center w-10 h-10 md:w-12 md:h-12 bg-primary rounded-lg shadow-md">
							<i className={`${icon} text-white text-lg md:text-xl`}></i>
						</div>
					)}
					<div>
						<h1 className="text-lg md:text-2xl font-semibold text-gray-800">{title}</h1>
						{subtitle && <p className="text-sm text-gray-500 mt-1">{subtitle}</p>}
					</div>
				</div>

				{buttons.length > 0 && (
					<div className="flex gap-2 flex-nowrap justify-between w-full md:w-auto mt-4 md:mt-0">
						{buttons.map((button, index) => (
							<button
								key={index}
								onClick={button.onClick}
								disabled={button.disabled}
								className={`btn ${button.variant || "primary"} ${button.className || ""} 
                  ${button.variant === "primary" ? "bg-primary hover:bg-primary-dark" : ""} 
                  ${
						button.variant === "csv"
							? "bg-linear-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 text-white"
							: ""
					}
                  ${button.variant === "secondary" ? "bg-secondary hover:bg-secondary-dark" : ""} 
                  ${button.variant === "secondary-wire" ? "border border-gray-300 hover:bg-gray-50" : ""} 
                  ${button.variant === "danger" ? "bg-red-600 hover:bg-red-700 text-white" : ""} 
                  transition-colors duration-200`}
							>
								{button.icon && <i className={`${button.icon} mr-2`}></i>}
								{button.loading ? "Caricamento..." : button.label}
							</button>
						))}
					</div>
				)}
			</div>
		</div>
	)
}

export default PageHeader
