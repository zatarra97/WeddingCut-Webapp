import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { toast } from "react-toastify"
import { genericGet, genericPost } from "../../services/api-utility"

interface Conversation {
	publicId: string
	subject: string
	orderId?: string
	status: "open" | "closed"
	lastMessageAt: string
	createdAt: string
	unreadCount: number
}

interface UserOrder {
	publicId: string
	coupleName: string
}

const MessageList = () => {
	const navigate = useNavigate()
	const [conversations, setConversations] = useState<Conversation[]>([])
	const [loading, setLoading] = useState(true)

	// Modale nuova conversazione
	const [showModal, setShowModal] = useState(false)
	const [subject, setSubject] = useState("")
	const [selectedOrderId, setSelectedOrderId] = useState("")
	const [orders, setOrders] = useState<UserOrder[]>([])
	const [creating, setCreating] = useState(false)

	const load = () =>
		genericGet("user/conversations")
			.then((data: Conversation[]) => setConversations(data))
			.catch(() => toast.error("Impossibile caricare le conversazioni"))
			.finally(() => setLoading(false))

	useEffect(() => {
		load()
		genericGet("user/orders")
			.then((data: UserOrder[]) => setOrders(data))
			.catch(() => {})
	}, [])

	const openModal = () => {
		setSubject("")
		setSelectedOrderId("")
		setShowModal(true)
	}

	const handleCreate = async () => {
		if (!subject.trim()) { toast.error("Inserisci un oggetto per la conversazione"); return }
		setCreating(true)
		try {
			const body: Record<string, string> = {subject: subject.trim()}
			if (selectedOrderId) body.orderId = selectedOrderId
			const conv = await genericPost("user/conversations", body)
			setShowModal(false)
			navigate(`/user/messages/${conv.publicId}`)
		} catch {
			toast.error("Errore durante la creazione della conversazione")
		} finally {
			setCreating(false)
		}
	}

	return (
		<div className="min-h-[calc(100vh-3.5rem)] bg-gray-100">
			<div className="container mx-auto px-4 py-6 md:py-8 max-w-3xl">
				<div className="flex items-center justify-between mb-6">
					<h1 className="text-2xl font-bold text-gray-800">Messaggi</h1>
					<button
						onClick={openModal}
						className="flex items-center gap-2 px-4 py-2 rounded-lg bg-purple-700 text-white text-sm font-medium hover:bg-purple-800 transition-colors cursor-pointer"
					>
						<i className="fa-solid fa-plus" />
						Nuova conversazione
					</button>
				</div>

				{loading ? (
					<div className="flex items-center gap-3 py-12 text-gray-500">
						<i className="fa-solid fa-spinner fa-spin text-purple-600 text-xl" />
						<span>Caricamento…</span>
					</div>
				) : conversations.length === 0 ? (
					<div className="bg-white rounded-xl border border-gray-200 shadow-sm p-12 text-center">
						<i className="fa-solid fa-comments text-4xl text-gray-300 mb-4 block" />
						<p className="text-gray-500 text-sm">Nessuna conversazione. Clicca "Nuova conversazione" per iniziare.</p>
					</div>
				) : (
					<div className="space-y-2">
						{conversations.map((conv) => (
							<button
								key={conv.publicId}
								onClick={() => navigate(`/user/messages/${conv.publicId}`)}
								className="w-full flex items-start gap-4 p-4 bg-white rounded-xl border border-gray-200 shadow-sm hover:border-purple-300 hover:shadow-md transition-all text-left cursor-pointer"
							>
								<div className="flex items-center justify-center w-10 h-10 rounded-full bg-purple-100 shrink-0">
									<i className="fa-solid fa-comment-dots text-purple-600" />
								</div>
								<div className="flex-1 min-w-0">
									<div className="flex items-center gap-2 flex-wrap">
										<span className="font-semibold text-gray-900 truncate">{conv.subject}</span>
										{conv.unreadCount > 0 && (
											<span className="inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1.5 rounded-full bg-purple-600 text-white text-xs font-bold">
												{conv.unreadCount}
											</span>
										)}
										{conv.status === "closed" && (
											<span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">Chiusa</span>
										)}
									</div>
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

			{/* Modale nuova conversazione */}
			{showModal && (
				<div className="fixed inset-0 z-50 flex items-center justify-center p-4">
					<div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={() => setShowModal(false)} />
					<div className="relative bg-white rounded-xl shadow-2xl w-full max-w-md p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
						<div className="flex items-center justify-between">
							<h2 className="text-lg font-bold text-gray-900">Nuova conversazione</h2>
							<button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600 cursor-pointer">
								<i className="fa-solid fa-xmark text-lg" />
							</button>
						</div>

						<div>
							<label className="block text-sm font-medium text-gray-700 mb-1">Oggetto *</label>
							<input
								type="text"
								value={subject}
								onChange={(e) => setSubject(e.target.value)}
								placeholder="Descrivi brevemente l'argomento…"
								className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
								autoFocus
							/>
						</div>

						{orders.length > 0 && (
							<div>
								<label className="block text-sm font-medium text-gray-700 mb-1">Collega a un ordine (opzionale)</label>
								<select
									value={selectedOrderId}
									onChange={(e) => setSelectedOrderId(e.target.value)}
									className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
								>
									<option value="">— Nessun ordine —</option>
									{orders.map((o) => (
										<option key={o.publicId} value={o.publicId}>{o.coupleName}</option>
									))}
								</select>
							</div>
						)}

						<div className="flex justify-end gap-3 pt-2">
							<button
								type="button"
								onClick={() => setShowModal(false)}
								disabled={creating}
								className="px-4 py-2 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 cursor-pointer"
							>
								Annulla
							</button>
							<button
								type="button"
								onClick={handleCreate}
								disabled={creating}
								className="flex items-center gap-2 px-4 py-2 rounded-lg bg-purple-700 text-white text-sm font-medium hover:bg-purple-800 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
							>
								{creating ? <><i className="fa-solid fa-spinner fa-spin" /> Creazione…</> : <><i className="fa-solid fa-paper-plane" /> Crea</>}
							</button>
						</div>
					</div>
				</div>
			)}
		</div>
	)
}

export default MessageList
