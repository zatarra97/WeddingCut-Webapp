import React from "react"
import { Link } from "react-router-dom"

interface NavbarProps {
	userEmail: string
	onLogout: () => void
}

const Navbar: React.FC<NavbarProps> = ({ userEmail, onLogout }) => {
	return (
		<header className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between h-14 px-4 md:px-6 bg-purple-700 text-white shadow-md">
			<Link
				to="/"
				className="flex items-center gap-2 font-semibold text-lg tracking-tight text-white hover:text-purple-100 transition-colors"
			>
				<i className="fa-solid fa-heart text-xl" aria-hidden />
				<span>WeddingCut</span>
			</Link>
			<div className="flex items-center gap-4">
				<span className="text-sm text-purple-100 truncate max-w-[180px] md:max-w-none" title={userEmail}>
					{userEmail}
				</span>
				<button
					type="button"
					onClick={onLogout}
					className="text-sm font-medium text-white hover:text-purple-200 underline underline-offset-2 transition-colors cursor-pointer"
				>
					Logout
				</button>
			</div>
		</header>
	)
}

export default Navbar
