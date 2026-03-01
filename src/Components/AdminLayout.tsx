import React, { useState, useEffect } from "react"
import { NavLink } from "react-router-dom"
import { genericGet } from "../services/api-utility"

interface AdminLayoutProps {
	children: React.ReactNode
	userEmail: string
	onLogout: () => void
}

const NAV_ITEMS = [
	{ to: "/admin",          icon: "fa-solid fa-gauge",          label: "Dashboard", end: true  },
	{ to: "/admin/services", icon: "fa-solid fa-film",           label: "Servizi",   end: false },
	{ to: "/admin/orders",   icon: "fa-solid fa-clipboard-list", label: "Ordini",    end: false },
	{ to: "/admin/messages", icon: "fa-solid fa-comments",       label: "Messaggi",  end: false },
	{ to: "/admin/users",    icon: "fa-solid fa-users",          label: "Utenti",    end: false },
]

const AdminLayout: React.FC<AdminLayoutProps> = ({ children, userEmail, onLogout }) => {
	const [expanded, setExpanded] = useState(true)
	const [unreadMessages, setUnreadMessages] = useState(0)

	useEffect(() => {
		const fetchUnread = () => {
			genericGet("admin/conversations")
				.then((data: { unreadCount: number }[]) => {
					const total = data.reduce((sum, c) => sum + (c.unreadCount || 0), 0)
					setUnreadMessages(total)
				})
				.catch(() => {})
		}
		fetchUnread()
		const interval = setInterval(fetchUnread, 60_000)
		return () => clearInterval(interval)
	}, [])

	const avatarLetter = userEmail.charAt(0).toUpperCase()

	return (
		<div className="flex h-screen overflow-hidden bg-[#f0f2f8]">

			{/* ── Sidebar ──────────────────────────────────────────────── */}
			<aside
				className={`flex flex-col shrink-0 bg-white border-r border-gray-200 transition-all duration-300 ${
					expanded ? "w-60" : "w-[68px]"
				}`}
			>
				{/* Logo */}
				<div
					className={`flex items-center h-16 shrink-0 border-b border-gray-100 ${
						expanded ? "px-5 gap-2.5" : "justify-center px-4"
					}`}
				>
					<i className="fa-solid fa-heart text-violet-600 text-lg shrink-0" aria-hidden />
					{expanded && (
						<span className="font-bold text-gray-800 text-sm tracking-wide whitespace-nowrap">
							WeddingCut
						</span>
					)}
				</div>

				{/* Nav items */}
				<nav className="flex-1 overflow-y-auto py-4 px-2 space-y-0.5">
					{NAV_ITEMS.map((item) => {
						const isMessages = item.label === "Messaggi"
						return (
							<NavLink
								key={item.to}
								to={item.to}
								end={item.end}
								title={!expanded ? item.label : undefined}
								className={({ isActive }) =>
									`relative flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors group ${
										isActive
											? "bg-violet-600 text-white shadow-sm"
											: "text-slate-600 hover:bg-slate-50 hover:text-slate-800"
									}`
								}
							>
								{({ isActive }) => (
									<>
										<i className={`${item.icon} w-4 text-center shrink-0`} aria-hidden />
										{expanded && <span className="flex-1 truncate">{item.label}</span>}

										{/* Badge messaggi non letti */}
										{isMessages && unreadMessages > 0 && (
											<span
												className={`flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-xs font-bold leading-none shrink-0 ${
													isActive ? "bg-white/20 text-white" : "bg-red-500 text-white"
												} ${expanded ? "" : "absolute -top-1 -right-1"}`}
											>
												{unreadMessages > 99 ? "99+" : unreadMessages}
											</span>
										)}

										{/* Tooltip per sidebar collassata */}
										{!expanded && (
											<span className="pointer-events-none absolute left-full ml-3 whitespace-nowrap rounded-md bg-gray-900 px-2.5 py-1 text-xs text-white opacity-0 group-hover:opacity-100 transition-opacity z-50 shadow-lg">
												{item.label}
												{isMessages && unreadMessages > 0 && ` (${unreadMessages})`}
											</span>
										)}
									</>
								)}
							</NavLink>
						)
					})}
				</nav>

				{/* User info + logout */}
				<div className={`shrink-0 border-t border-gray-100 py-3 ${expanded ? "px-3" : "px-2"}`}>
					{expanded ? (
						<div className="flex items-center gap-3 px-2 py-2 rounded-lg">
							<div className="flex items-center justify-center w-8 h-8 rounded-full bg-violet-100 text-violet-600 text-xs font-bold shrink-0">
								{avatarLetter}
							</div>
							<div className="flex-1 min-w-0">
								<p className="text-xs font-semibold text-gray-800 truncate">{userEmail}</p>
								<p className="text-xs text-gray-400">Amministratore</p>
							</div>
							<button
								onClick={onLogout}
								title="Logout"
								className="text-gray-400 hover:text-gray-700 transition-colors cursor-pointer p-1"
							>
								<i className="fa-solid fa-right-from-bracket text-sm" aria-hidden />
							</button>
						</div>
					) : (
						<div className="flex flex-col items-center gap-2">
							<div
								className="flex items-center justify-center w-8 h-8 rounded-full bg-violet-100 text-violet-600 text-xs font-bold"
								title={userEmail}
							>
								{avatarLetter}
							</div>
							<button
								onClick={onLogout}
								title="Logout"
								className="text-gray-400 hover:text-gray-700 transition-colors cursor-pointer p-1"
							>
								<i className="fa-solid fa-right-from-bracket text-sm" aria-hidden />
							</button>
						</div>
					)}
				</div>
			</aside>

			{/* ── Right side ───────────────────────────────────────────── */}
			<div className="flex flex-col flex-1 min-w-0">

				{/* Top bar */}
				<header className="flex items-center h-16 px-5 bg-white border-b border-gray-200 shrink-0 gap-4">
					<button
						onClick={() => setExpanded((prev) => !prev)}
						aria-label="Espandi/comprimi sidebar"
						className="flex items-center justify-center w-9 h-9 rounded-lg text-gray-500 hover:bg-gray-100 transition-colors cursor-pointer shrink-0"
					>
						<i className="fa-solid fa-bars" aria-hidden />
					</button>

					<div className="flex-1" />

					<div className="flex items-center gap-3">
						<span className="hidden sm:block text-sm text-gray-500 truncate max-w-[200px]">
							{userEmail}
						</span>
						<div className="flex items-center justify-center w-8 h-8 rounded-full bg-violet-100 text-violet-600 text-xs font-bold">
							{avatarLetter}
						</div>
					</div>
				</header>

				{/* Page content */}
				<main className="flex-1 min-h-0 overflow-y-auto">
					{children}
				</main>
			</div>
		</div>
	)
}

export default AdminLayout
