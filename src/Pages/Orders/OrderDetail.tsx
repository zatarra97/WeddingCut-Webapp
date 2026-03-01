import { useState, useEffect } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { toast } from "react-toastify"
import { genericGet } from "../../services/api-utility"

interface SelectedService {
	publicId: string
	orientation: "vertical" | "horizontal" | "both"
	duration?: number
	notes?: string
}

interface Order {
	publicId: string
	coupleName: string
	weddingDate: string
	deliveryMethod: "cloud_link" | "upload_request"
	materialLink?: string
	materialSizeGb: number
	cameraCount: "1-4" | "5-6" | "7+"
	generalNotes?: string
	referenceVideo?: string
	exportFps?: string
	exportBitrate?: string
	exportAspect?: string
	exportResolution?: string
	selectedServices: SelectedService[]
	servicesTotal?: number
	cameraSurcharge: number
	totalPrice?: number
	status: "pending" | "in_progress" | "completed" | "cancelled"
	adminNotes?: string
	deliveryLink?: string
	createdAt: string
	updatedAt: string
}

const STATUS_LABELS: Record<string, string> = {
	pending:     "In attesa",
	in_progress: "In lavorazione",
	completed:   "Completato",
	cancelled:   "Annullato",
}

const STATUS_CLASSES: Record<string, string> = {
	pending:     "bg-yellow-100 text-yellow-800",
	in_progress: "bg-blue-100 text-blue-800",
	completed:   "bg-green-100 text-green-800",
	cancelled:   "bg-gray-100 text-gray-600",
}

const ORIENTATION_LABELS: Record<string, string> = {
	vertical:   "Verticale",
	horizontal: "Orizzontale",
	both:       "Entrambi",
}

const DELIVERY_LABELS: Record<string, string> = {
	cloud_link:      "Link cloud",
	upload_request:  "Link di caricamento richiesto",
}

const InfoRow = ({ label, value }: { label: string; value?: string | number | null }) => {
	if (!value && value !== 0) return null
	return (
		<div className="flex flex-col sm:flex-row sm:items-start gap-0.5 sm:gap-3 py-2 border-b border-gray-100 last:border-0">
			<span className="text-xs font-semibold text-gray-400 uppercase tracking-wide sm:w-40 shrink-0">{label}</span>
			<span className="text-sm text-gray-800">{value}</span>
		</div>
	)
}

const OrderDetail = () => {
	const navigate = useNavigate()
	const { publicId } = useParams<{ publicId: string }>()
	const [order, setOrder] = useState<Order | null>(null)
	const [loading, setLoading] = useState(true)

	useEffect(() => {
		if (!publicId) return
		genericGet(`user/orders/${publicId}`)
			.then((data: Order) => setOrder(data))
			.catch(() => {
				toast.error("Ordine non trovato o accesso negato")
				navigate("/user/orders")
			})
			.finally(() => setLoading(false))
	}, [publicId])

	if (loading) {
		return (
			<div className="min-h-[calc(100vh-3.5rem)] flex items-center justify-center">
				<div className="text-center">
					<div className="animate-spin rounded-full h-10 w-10 border-b-2 border-purple-600 mx-auto mb-3" />
					<p className="text-gray-500 text-sm">Caricamento ordine…</p>
				</div>
			</div>
		)
	}

	if (!order) return null

	return (
		<div className="min-h-[calc(100vh-3.5rem)] bg-gray-100">
			<div className="container mx-auto px-4 py-6 md:py-8 max-w-4xl">
				{/* Intestazione */}
				<div className="flex items-center gap-3 mb-6">
					<button
						onClick={() => navigate("/user/orders")}
						className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition-colors cursor-pointer"
					>
						<i className="fa-solid fa-arrow-left" />
						Ordini
					</button>
					<span className="text-gray-300">/</span>
					<h1 className="text-xl font-bold text-gray-800">{order.coupleName}</h1>
					<span className={`ml-auto inline-flex items-center text-xs font-semibold px-2.5 py-1 rounded-full ${STATUS_CLASSES[order.status] ?? "bg-gray-100 text-gray-600"}`}>
						{STATUS_LABELS[order.status] ?? order.status}
					</span>
				</div>

				<div className="space-y-6">
					{/* Stato ordine — consegna e note admin */}
					{(order.status === "completed" && order.deliveryLink) || order.adminNotes ? (
						<div className="rounded-xl border border-purple-200 bg-purple-50 shadow-sm p-6 space-y-4">
							<h2 className="text-base font-semibold text-purple-800">
								<i className="fa-solid fa-circle-info mr-2" />
								Aggiornamenti
							</h2>
							{order.adminNotes && (
								<div>
									<p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Note dal team</p>
									<p className="text-sm text-gray-700 whitespace-pre-wrap">{order.adminNotes}</p>
								</div>
							)}
							{order.status === "completed" && order.deliveryLink && (
								<a
									href={order.deliveryLink}
									target="_blank"
									rel="noopener noreferrer"
									className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-green-600 text-white text-sm font-medium hover:bg-green-700 transition-colors"
								>
									<i className="fa-solid fa-download" />
									Scarica video
								</a>
							)}
						</div>
					) : null}

					{/* Info progetto */}
					<div className="rounded-xl border border-gray-200 bg-white shadow-sm p-6">
						<h2 className="text-base font-semibold text-gray-800 mb-4">Info progetto</h2>
						<InfoRow label="Coppia" value={order.coupleName} />
						<InfoRow label="Data matrimonio" value={order.weddingDate} />
						<InfoRow label="Telecamere" value={order.cameraCount} />
						<InfoRow label="Creato il" value={new Date(order.createdAt).toLocaleString("it-IT")} />
					</div>

					{/* Servizi selezionati */}
					<div className="rounded-xl border border-gray-200 bg-white shadow-sm p-6">
						<h2 className="text-base font-semibold text-gray-800 mb-4">Servizi selezionati</h2>
						{Array.isArray(order.selectedServices) && order.selectedServices.length > 0 ? (
							<div className="space-y-3">
								{order.selectedServices.map((s: SelectedService, i: number) => (
									<div key={i} className="flex flex-wrap items-start gap-2 py-2 border-b border-gray-100 last:border-0">
										<span className="text-sm font-medium text-gray-700 font-mono text-xs bg-gray-100 px-2 py-0.5 rounded">{s.publicId}</span>
										<span className="text-xs text-gray-500">{ORIENTATION_LABELS[s.orientation] ?? s.orientation}</span>
										{s.duration != null && <span className="text-xs text-gray-500">{s.duration} min</span>}
										{s.notes && <p className="w-full text-xs text-gray-500 italic mt-0.5">{s.notes}</p>}
									</div>
								))}
								{order.totalPrice != null && (
									<div className="flex justify-between items-center pt-2 font-semibold text-sm">
										<span className="text-gray-700">Totale</span>
										<span className="text-purple-700">€{Number(order.totalPrice).toFixed(2)}</span>
									</div>
								)}
							</div>
						) : (
							<p className="text-sm text-gray-400 italic">Nessun servizio</p>
						)}
					</div>

					{/* Materiale */}
					<div className="rounded-xl border border-gray-200 bg-white shadow-sm p-6">
						<h2 className="text-base font-semibold text-gray-800 mb-4">Materiale</h2>
						<InfoRow label="Consegna" value={DELIVERY_LABELS[order.deliveryMethod] ?? order.deliveryMethod} />
						{order.materialLink && <InfoRow label="Link" value={order.materialLink} />}
						<InfoRow label="Dimensione" value={`${order.materialSizeGb} GB`} />
						{order.generalNotes && <InfoRow label="Note generali" value={order.generalNotes} />}
						{order.referenceVideo && <InfoRow label="Video riferimento" value={order.referenceVideo} />}
					</div>

					{/* Impostazioni export */}
					{(order.exportFps || order.exportBitrate || order.exportAspect || order.exportResolution) && (
						<div className="rounded-xl border border-gray-200 bg-white shadow-sm p-6">
							<h2 className="text-base font-semibold text-gray-800 mb-4">Impostazioni esportazione</h2>
							<InfoRow label="Frame rate" value={order.exportFps ? `${order.exportFps} fps` : null} />
							<InfoRow label="Bitrate" value={order.exportBitrate ? `${order.exportBitrate} Mbps` : null} />
							<InfoRow label="Formato" value={order.exportAspect} />
							<InfoRow label="Risoluzione" value={order.exportResolution} />
						</div>
					)}
				</div>
			</div>
		</div>
	)
}

export default OrderDetail
