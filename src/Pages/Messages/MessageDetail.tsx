import { useState, useEffect, useRef } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { toast } from "react-toastify"
import { genericGet, genericPost } from "../../services/api-utility"

interface Message {
	publicId: string
	senderRole: "user" | "admin"
	senderEmail: string
	content: string
	createdAt: string
}

interface Conversation {
	publicId: string
	subject: string
	orderId?: string
	status: "open" | "closed"
}

const POLL_INTERVAL = 5000

const MessageDetail = () => {
	const navigate = useNavigate()
	const { publicId } = useParams<{ publicId: string }>()
	const [conv, setConv] = useState<Conversation | null>(null)
	const [messages, setMessages] = useState<Message[]>([])
	const [loading, setLoading] = useState(true)
	const [content, setContent] = useState("")
	const [sending, setSending] = useState(false)
	const bottomRef = useRef<HTMLDivElement>(null)
	const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

	const fetchMessages = async (silent = false) => {
		if (!publicId) return
		try {
			const data: Message[] = await genericGet(`user/conversations/${publicId}/messages`)
			setMessages(data)
			if (!silent) setLoading(false)
		} catch {
			if (!silent) {
				toast.error("Conversazione non trovata o accesso negato")
				navigate("/user/messages")
			}
		}
	}

	useEffect(() => {
		if (!publicId) return

		// Carica info conversazione
		genericGet("user/conversations")
			.then((convs: Conversation[]) => {
				const found = convs.find((c) => c.publicId === publicId)
				if (found) setConv(found)
			})
			.catch(() => {})

		// Prima fetch
		fetchMessages()

		// Polling ogni 5 secondi
		intervalRef.current = setInterval(() => fetchMessages(true), POLL_INTERVAL)
		return () => {
			if (intervalRef.current) clearInterval(intervalRef.current)
		}
	}, [publicId])

	// Scroll al fondo quando arrivano nuovi messaggi
	useEffect(() => {
		bottomRef.current?.scrollIntoView({behavior: "smooth"})
	}, [messages])

	const handleSend = async () => {
		if (!content.trim() || !publicId) return
		setSending(true)
		try {
			const msg: Message = await genericPost(`user/conversations/${publicId}/messages`, {content: content.trim()})
			setMessages((prev) => [...prev, msg])
			setContent("")
		} catch (err: any) {
			const detail = err?.response?.data?.error?.message
			toast.error(detail ?? "Errore durante l'invio del messaggio")
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

	if (loading) {
		return (
			<div className="min-h-[calc(100vh-3.5rem)] flex items-center justify-center">
				<div className="text-center">
					<div className="animate-spin rounded-full h-10 w-10 border-b-2 border-purple-600 mx-auto mb-3" />
					<p className="text-gray-500 text-sm">Caricamento messaggi…</p>
				</div>
			</div>
		)
	}

	const isClosed = conv?.status === "closed"

	return (
		<div className="flex flex-col h-[calc(100vh-3.5rem)] bg-gray-100">
			{/* Header */}
			<div className="bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-3 shrink-0">
				<button
					onClick={() => navigate("/user/messages")}
					className="text-gray-400 hover:text-gray-700 transition-colors cursor-pointer"
					aria-label="Torna indietro"
				>
					<i className="fa-solid fa-arrow-left" />
				</button>
				<div className="flex-1 min-w-0">
					<h1 className="font-semibold text-gray-900 truncate">{conv?.subject ?? "Conversazione"}</h1>
					{conv?.orderId && (
						<p className="text-xs text-gray-400">
							<i className="fa-solid fa-link mr-1" />
							Ordine collegato
						</p>
					)}
				</div>
				{isClosed && (
					<span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-full shrink-0">Chiusa</span>
				)}
			</div>

			{/* Thread messaggi */}
			<div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
				{messages.length === 0 ? (
					<div className="flex items-center justify-center h-full text-gray-400 text-sm">
						Nessun messaggio ancora. Scrivi il primo!
					</div>
				) : (
					messages.map((msg) => {
						const isUser = msg.senderRole === "user"
						return (
							<div key={msg.publicId} className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
								<div className={`max-w-[75%] rounded-2xl px-4 py-2.5 shadow-sm ${isUser ? "bg-purple-600 text-white rounded-br-sm" : "bg-white text-gray-800 rounded-bl-sm border border-gray-200"}`}>
									{!isUser && (
										<p className="text-xs font-semibold text-purple-600 mb-1">WeddingCut Team</p>
									)}
									<p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p>
									<p className={`text-[10px] mt-1 ${isUser ? "text-purple-200 text-right" : "text-gray-400"}`}>
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
						Questa conversazione è chiusa.
					</p>
				) : (
					<div className="flex items-end gap-3">
						<textarea
							value={content}
							onChange={(e) => setContent(e.target.value)}
							onKeyDown={handleKeyDown}
							placeholder="Scrivi un messaggio… (Invio per inviare, Shift+Invio per andare a capo)"
							rows={2}
							className="flex-1 resize-none rounded-xl border border-gray-300 px-3 py-2 text-sm focus:border-purple-500 focus:ring-1 focus:ring-purple-500 outline-none"
						/>
						<button
							onClick={handleSend}
							disabled={sending || !content.trim()}
							className="flex items-center justify-center w-10 h-10 rounded-full bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer shrink-0"
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

export default MessageDetail
