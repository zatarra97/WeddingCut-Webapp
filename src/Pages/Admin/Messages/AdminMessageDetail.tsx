import { useState, useEffect, useRef } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { toast } from "react-toastify"
import { genericGet, genericPost, genericPatch } from "../../../services/api-utility"

interface Message {
	publicId: string
	senderRole: "user" | "admin"
	senderEmail: string
	content: string
	createdAt: string
}

interface Conversation {
	publicId: string
	userEmail: string
	subject: string
	orderId?: string
	status: "open" | "closed"
}

const POLL_INTERVAL = 5000

const AdminMessageDetail = () => {
	const navigate = useNavigate()
	const { publicId } = useParams<{ publicId: string }>()
	const [conv, setConv] = useState<Conversation | null>(null)
	const [messages, setMessages] = useState<Message[]>([])
	const [loading, setLoading] = useState(true)
	const [content, setContent] = useState("")
	const [sending, setSending] = useState(false)
	const [togglingStatus, setTogglingStatus] = useState(false)
	const bottomRef = useRef<HTMLDivElement>(null)
	const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

	const fetchMessages = async (silent = false) => {
		if (!publicId) return
		try {
			const data: Message[] = await genericGet(`admin/conversations/${publicId}/messages`)
			setMessages(data)
			if (!silent) setLoading(false)
		} catch {
			if (!silent) {
				toast.error("Conversazione non trovata")
				navigate("/admin/messages")
			}
		}
	}

	useEffect(() => {
		if (!publicId) return

		// Carica la lista per estrarre info conversazione
		genericGet("admin/conversations")
			.then((convs: Conversation[]) => {
				const found = convs.find((c) => c.publicId === publicId)
				if (found) setConv(found)
			})
			.catch(() => {})

		fetchMessages()

		intervalRef.current = setInterval(() => fetchMessages(true), POLL_INTERVAL)
		return () => {
			if (intervalRef.current) clearInterval(intervalRef.current)
		}
	}, [publicId])

	useEffect(() => {
		bottomRef.current?.scrollIntoView({behavior: "smooth"})
	}, [messages])

	const handleSend = async () => {
		if (!content.trim() || !publicId) return
		setSending(true)
		try {
			const msg: Message = await genericPost(`admin/conversations/${publicId}/messages`, {content: content.trim()})
			setMessages((prev) => [...prev, msg])
			setContent("")
		} catch {
			toast.error("Errore durante l'invio del messaggio")
		} finally {
			setSending(false)
		}
	}

	const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
		if (e.key === "Enter" && !e.shiftKey) {
			e.preventDefault()
			handleSend()
		}
	}

	const toggleStatus = async () => {
		if (!publicId || !conv) return
		const newStatus = conv.status === "open" ? "closed" : "open"
		setTogglingStatus(true)
		try {
			await genericPatch(`admin/conversations/${publicId}`, {status: newStatus})
			setConv((prev) => prev ? {...prev, status: newStatus} : prev)
			toast.success(newStatus === "closed" ? "Conversazione chiusa" : "Conversazione riaperta")
		} catch {
			toast.error("Errore durante l'aggiornamento")
		} finally {
			setTogglingStatus(false)
		}
	}

	if (loading) {
		return (
			<div className="min-h-full flex items-center justify-center">
				<div className="text-center">
					<div className="animate-spin rounded-full h-10 w-10 border-b-2 border-purple-600 mx-auto mb-3" />
					<p className="text-gray-500 text-sm">Caricamento messaggi…</p>
				</div>
			</div>
		)
	}

	const isClosed = conv?.status === "closed"

	return (
		<div className="flex flex-col h-full bg-gray-100">
			{/* Header */}
			<div className="bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-3 shrink-0">
				<button
					onClick={() => navigate("/admin/messages")}
					className="text-gray-400 hover:text-gray-700 transition-colors cursor-pointer"
					aria-label="Torna indietro"
				>
					<i className="fa-solid fa-arrow-left" />
				</button>
				<div className="flex-1 min-w-0">
					<h1 className="font-semibold text-gray-900 truncate">{conv?.subject ?? "Conversazione"}</h1>
					<p className="text-xs text-gray-400">{conv?.userEmail}</p>
				</div>
				<button
					onClick={toggleStatus}
					disabled={togglingStatus}
					className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer disabled:opacity-50 ${
						isClosed
							? "bg-green-50 text-green-700 border border-green-200 hover:bg-green-100"
							: "bg-gray-100 text-gray-600 border border-gray-200 hover:bg-gray-200"
					}`}
				>
					{togglingStatus
						? <i className="fa-solid fa-spinner fa-spin" />
						: isClosed
							? <><i className="fa-solid fa-lock-open" /> Riapri</>
							: <><i className="fa-solid fa-lock" /> Chiudi</>
					}
				</button>
			</div>

			{/* Thread messaggi */}
			<div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
				{messages.length === 0 ? (
					<div className="flex items-center justify-center h-full text-gray-400 text-sm">
						Nessun messaggio ancora.
					</div>
				) : (
					messages.map((msg) => {
						const isAdmin = msg.senderRole === "admin"
						return (
							<div key={msg.publicId} className={`flex ${isAdmin ? "justify-end" : "justify-start"}`}>
								<div className={`max-w-[75%] rounded-2xl px-4 py-2.5 shadow-sm ${isAdmin ? "bg-gray-800 text-white rounded-br-sm" : "bg-white text-gray-800 rounded-bl-sm border border-gray-200"}`}>
									{!isAdmin && (
										<p className="text-xs font-semibold text-purple-600 mb-1">{msg.senderEmail}</p>
									)}
									<p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p>
									<p className={`text-[10px] mt-1 ${isAdmin ? "text-gray-400 text-right" : "text-gray-400"}`}>
										{new Date(msg.createdAt).toLocaleString("it-IT", {hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit"})}
									</p>
								</div>
							</div>
						)
					})
				)}
				<div ref={bottomRef} />
			</div>

			{/* Input */}
			<div className="bg-white border-t border-gray-200 px-4 py-3 shrink-0">
				{isClosed ? (
					<p className="text-center text-sm text-gray-400 py-1">
						<i className="fa-solid fa-lock mr-2" />
						Conversazione chiusa. Riaprila per rispondere.
					</p>
				) : (
					<div className="flex items-end gap-3">
						<textarea
							value={content}
							onChange={(e) => setContent(e.target.value)}
							onKeyDown={handleKeyDown}
							placeholder="Scrivi una risposta… (Invio per inviare, Shift+Invio per andare a capo)"
							rows={2}
							className="flex-1 resize-none rounded-xl border border-gray-300 px-3 py-2 text-sm focus:border-gray-500 focus:ring-1 focus:ring-gray-500 outline-none"
						/>
						<button
							onClick={handleSend}
							disabled={sending || !content.trim()}
							className="flex items-center justify-center w-10 h-10 rounded-full bg-gray-800 text-white hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer shrink-0"
							aria-label="Invia"
						>
							{sending ? <i className="fa-solid fa-spinner fa-spin text-sm" /> : <i className="fa-solid fa-paper-plane text-sm" />}
						</button>
					</div>
				)}
			</div>
		</div>
	)
}

export default AdminMessageDetail
