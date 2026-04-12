import React, { useState } from "react"
import { Link } from "react-router-dom"
import logoOrizzontale from "../Images/logo.png"

interface NavbarProps {
	userEmail: string
	onLogout: () => void
	homeRoute?: string
}

const Navbar: React.FC<NavbarProps> = ({ userEmail, onLogout, homeRoute = "/" }) => {
	const initials = userEmail ? userEmail.charAt(0).toUpperCase() : "?"
	const [dropdownOpen, setDropdownOpen] = useState(false)

	return (
		<header className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between h-16 px-4 md:px-6 bg-[#1a1a2e] text-white shadow-lg shadow-black/20">
			<Link to={homeRoute} className="flex items-center">
				<img src={logoOrizzontale} alt="WeddingCut" className="h-8 md:h-9 w-auto" />
			</Link>

			<div className="relative">
				<button
					type="button"
					onClick={() => setDropdownOpen((v) => !v)}
					className="flex items-center gap-2.5 cursor-pointer"
				>
					<div className="flex items-center justify-center w-8 h-8 rounded-full bg-[#7c3aed] text-white text-xs font-bold">
						{initials}
					</div>
					<span className="hidden md:inline text-sm text-white/70 truncate max-w-[200px]" title={userEmail}>
						{userEmail}
					</span>
				</button>

				{dropdownOpen && (
					<>
						{/* Overlay per chiudere */}
						<div
							className="fixed inset-0 z-40"
							onClick={() => setDropdownOpen(false)}
						/>
						{/* Dropdown */}
						<div className="absolute right-0 top-11 z-50 w-48 bg-white rounded-xl border border-gray-200 shadow-lg py-1 overflow-hidden">
							<div className="px-3 py-2 border-b border-gray-100">
								<p className="text-xs text-gray-400 truncate">{userEmail}</p>
							</div>
							<button
								type="button"
								onClick={() => { setDropdownOpen(false); onLogout() }}
								className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
							>
								<i className="fa-solid fa-right-from-bracket text-xs" aria-hidden />
								Logout
							</button>
						</div>
					</>
				)}
			</div>
		</header>
	)
}

export default Navbar
