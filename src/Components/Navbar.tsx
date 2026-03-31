import React from "react"
import { Link } from "react-router-dom"
import logoOrizzontale from "../Images/logo.png"

interface NavbarProps {
	userEmail: string
	onLogout: () => void
	homeRoute?: string
}

const Navbar: React.FC<NavbarProps> = ({ userEmail, onLogout, homeRoute = "/" }) => {
	const initials = userEmail ? userEmail.charAt(0).toUpperCase() : "?"

	return (
		<header className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between h-16 px-4 md:px-6 bg-[#1a1a2e] text-white shadow-lg shadow-black/20">
			<Link to={homeRoute} className="flex items-center">
				<img src={logoOrizzontale} alt="WeddingCut" className="h-8 md:h-9 w-auto" />
			</Link>
			<div className="flex items-center gap-3">
				<div className="flex items-center gap-2.5">
					<div className="flex items-center justify-center w-8 h-8 rounded-full bg-[#8b6f4e] text-white text-xs font-bold">{initials}</div>
					<span className="hidden md:inline text-sm text-white/70 truncate max-w-[200px]" title={userEmail}>
						{userEmail}
					</span>
				</div>
				<button
					type="button"
					onClick={onLogout}
					className="text-sm font-medium text-white/70 hover:text-white hover:bg-white/10 px-3 py-1.5 rounded-full transition-colors cursor-pointer"
				>
					Logout
				</button>
			</div>
		</header>
	)
}

export default Navbar
