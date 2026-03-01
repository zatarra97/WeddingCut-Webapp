import { useState, useEffect } from "react"
import { NavLink } from "react-router-dom"
import { genericGet } from "../services/api-utility"

const UserNav = () => {
	const [unreadMessages, setUnreadMessages] = useState(0)

	const fetchUnread = () => {
		genericGet("user/conversations")
			.then((data: { unreadCount: number }[]) => {
				const total = data.reduce((sum, c) => sum + (c.unreadCount || 0), 0)
				setUnreadMessages(total)
			})
			.catch(() => {})
	}

	useEffect(() => {
		fetchUnread()
		const interval = setInterval(fetchUnread, 60_000)
		return () => clearInterval(interval)
	}, [])

	return (
		<nav className="fixed top-14 left-0 right-0 z-40 h-12 bg-white border-b border-gray-200 shadow-sm">
			<div className="container mx-auto flex items-center gap-1 px-4 md:px-6 h-full">
				<NavLink
					to="/user/dashboard"
					className={({ isActive }) =>
						`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
							isActive
								? "bg-purple-100 text-purple-700"
								: "text-gray-600 hover:bg-gray-100 hover:text-gray-800"
						}`
					}
				>
					<i className="fa-solid fa-clipboard-list" aria-hidden />
					Ordini
				</NavLink>
				<NavLink
					to="/user/messages"
					className={({ isActive }) =>
						`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
							isActive
								? "bg-purple-100 text-purple-700"
								: "text-gray-600 hover:bg-gray-100 hover:text-gray-800"
						}`
					}
				>
					<i className="fa-solid fa-comments" aria-hidden />
					Messaggi
					{unreadMessages > 0 && (
						<span className="flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-purple-600 text-white text-xs font-bold leading-none">
							{unreadMessages > 99 ? "99+" : unreadMessages}
						</span>
					)}
				</NavLink>
			</div>
		</nav>
	)
}

export default UserNav
