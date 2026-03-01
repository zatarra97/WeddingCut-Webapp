import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { toast } from "react-toastify"
import { genericGet } from "../../../services/api-utility"

interface Conversation {
	publicId: string
	userEmail: string
	subject: string
	orderId?: string
	status: "open" | "closed"
	lastMessageAt: string
	unreadCount: number
}

const STATUS_OPTIONS = [
	{ value: "", label: "Tutti gli stati" },
	{ value: "open", label: "Aperte" },
	{ value: "closed", label: "Chiuse" },
]

const AdminMessageList = () => {
	const navigate = useNavigate()
	const [conversations, setConversations] = useState<Conversation[]>([])
	const [loading, setLoading] = useState(true)
	const [statusFilter, setStatusFilter] = useState("")
	const [emailSearch, setEmailSearch] = useState("")

	const load = () => {
		setLoading(true)
		const params = new URLSearchParams()
		if (statusFilter) params.append("status", statusFilter)
		if (emailSearch.trim()) params.append("userEmail", emailSearch.trim())
		const qs = params.toString()
		genericGet(`admin/conversations${qs ? `?${qs}` : ""}`)
			.then((data: Conversation[]) => setConversations(data))
			.catch(() => toast.error("Impossibile caricare le conversazioni"))
			.finally(() => setLoading(false))
	}

	useEffect(() => { load() }, [statusFilter, emailSearch])

	const totalUnread = conversations.reduce((s, c) => s + c.unreadCount, 0)

	return (
		<div className="min-h-[calc(100vh-64px)]">
			<nav className="sticky top-14 z-40 h-12 bg-gray-800 text-white shadow-sm">
				<div className="container mx-auto flex items-center gap-3 px-4 md:px-6 pt-3">
					<span className="text-sm font-medium">Messaggi</span>
					{totalUnread > 0 && (
						<span className="inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1.5 rounded-full bg-red-500 text-white text-xs font-bold">
							{totalUnread}
						</span>
					)}
				</div>
			</nav>

			<div className="container mx-auto p-4 md:p-6 max-w-3xl">
				<h1 className="text-2xl font-bold text-gray-800 mb-6">Conversazioni</h1>

				{/* Filtri */}
				<div className="flex flex-col sm:flex-row gap-3 mb-6">
					<select
						value={statusFilter}
						onChange={(e) => setStatusFilter(e.target.value)}
						className="block rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 shadow-sm focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
					>
						{STATUS_OPTIONS.map((o) => (
							<option key={o.value} value={o.value}>{o.label}</option>
						))}
					</select>
					<input
						type="text"
						placeholder="Cerca per email utente…"
						value={emailSearch}
						onChange={(e) => setEmailSearch(e.target.value)}
						className="block flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 shadow-sm focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
					/>
				</div>

				{loading ? (
					<div className="flex items-center gap-3 py-12 text-gray-500">
						<i className="fa-solid fa-spinner fa-spin text-purple-600 text-xl" />
						<span>Caricamento…</span>
					</div>
				) : conversations.length === 0 ? (
					<div className="bg-white rounded-xl border border-gray-200 shadow-sm p-12 text-center">
						<i className="fa-solid fa-comments text-4xl text-gray-300 mb-4 block" />
						<p className="text-gray-500 text-sm">Nessuna conversazione trovata.</p>
					</div>
				) : (
					<div className="space-y-2">
						{conversations.map((conv) => (
							<button
								key={conv.publicId}
								onClick={() => navigate(`/admin/messages/${conv.publicId}`)}
								className="w-full flex items-start gap-4 p-4 bg-white rounded-xl border border-gray-200 shadow-sm hover:border-purple-300 hover:shadow-md transition-all text-left cursor-pointer"
							>
								<div className="relative flex items-center justify-center w-10 h-10 rounded-full bg-gray-100 shrink-0">
									<i className="fa-solid fa-comment-dots text-gray-500" />
									{conv.unreadCount > 0 && (
										<span className="absolute -top-1 -right-1 flex items-center justify-center min-w-[1.1rem] h-[1.1rem] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold">
											{conv.unreadCount}
										</span>
									)}
								</div>
								<div className="flex-1 min-w-0">
									<div className="flex items-center gap-2 flex-wrap">
										<span className={`font-semibold truncate ${conv.unreadCount > 0 ? "text-gray-900" : "text-gray-700"}`}>
											{conv.subject}
										</span>
										{conv.status === "closed" && (
											<span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">Chiusa</span>
										)}
									</div>
									<p className="text-xs text-gray-500 mt-0.5">{conv.userEmail}</p>
									{conv.orderId && (
										<p className="text-xs text-gray-400 mt-0.5">
											<i className="fa-solid fa-link mr-1" />
											Ordine collegato
										</p>
									)}
									<p className="text-xs text-gray-400 mt-0.5">
										{new Date(conv.lastMessageAt).toLocaleString("it-IT")}
									</p>
								</div>
								<i className="fa-solid fa-chevron-right text-gray-300 text-sm mt-1 shrink-0" />
							</button>
						))}
					</div>
				)}
			</div>
		</div>
	)
}

export default AdminMessageList
