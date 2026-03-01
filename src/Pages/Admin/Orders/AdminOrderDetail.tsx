import { useState, useEffect } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { toast } from "react-toastify"
import { genericGet, genericPatch, genericDelete } from "../../../services/api-utility"
import DeleteModal from "../../../Components/DeleteModal"

interface SelectedService {
	publicId: string
	orientation: "vertical" | "horizontal" | "both"
	duration?: number
	notes?: string
}

interface Order {
	publicId: string
	userEmail: string
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

const STATUS_OPTIONS = [
	{ value: "pending", label: "In attesa" },
	{ value: "in_progress", label: "In lavorazione" },
	{ value: "completed", label: "Completato" },
	{ value: "cancelled", label: "Annullato" },
]

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
	cloud_link:     "Link cloud",
	upload_request: "Link di caricamento richiesto",
}

const InfoRow = ({ label, value }: { label: string; value?: string | number | null }) => {
	if (!value && value !== 0) return null
	return (
		<div className="flex flex-col sm:flex-row sm:items-start gap-0.5 sm:gap-3 py-2 border-b border-gray-100 last:border-0">
			<span className="text-xs font-semibold text-gray-400 uppercase tracking-wide sm:w-44 shrink-0">{label}</span>
			<span className="text-sm text-gray-800 break-all">{value}</span>
		</div>
	)
}

const AdminOrderDetail = () => {
	const navigate = useNavigate()
	const { publicId } = useParams<{ publicId: string }>()
	const [order, setOrder] = useState<Order | null>(null)
	const [loading, setLoading] = useState(true)

	// Form stato admin
	const [adminStatus, setAdminStatus] = useState("")
	const [adminNotes, setAdminNotes] = useState("")
	const [deliveryLink, setDeliveryLink] = useState("")
	const [saving, setSaving] = useState(false)

	// Delete modal
	const [deleteOpen, setDeleteOpen] = useState(false)
	const [deleting, setDeleting] = useState(false)

	useEffect(() => {
		if (!publicId) return
		genericGet(`admin/orders/${publicId}`)
			.then((data: Order) => {
				setOrder(data)
				setAdminStatus(data.status)
				setAdminNotes(data.adminNotes ?? "")
				setDeliveryLink(data.deliveryLink ?? "")
			})
			.catch(() => {
				toast.error("Ordine non trovato")
				navigate("/admin/orders")
			})
			.finally(() => setLoading(false))
	}, [publicId])

	const handleSave = async () => {
		if (!publicId) return
		setSaving(true)
		try {
			await genericPatch(`admin/orders/${publicId}`, {
				status: adminStatus,
				adminNotes: adminNotes.trim() || null,
				deliveryLink: deliveryLink.trim() || null,
			})
			toast.success("Modifiche salvate")
			setOrder((prev) => prev ? { ...prev, status: adminStatus as Order["status"], adminNotes: adminNotes.trim() || undefined, deliveryLink: deliveryLink.trim() || undefined } : prev)
		} catch {
			toast.error("Errore durante il salvataggio")
		} finally {
			setSaving(false)
		}
	}

	const handleDelete = async () => {
		if (!publicId) return
		setDeleting(true)
		try {
			await genericDelete(`admin/orders/${publicId}`)
			toast.success("Ordine eliminato")
			navigate("/admin/orders")
		} catch {
			toast.error("Errore durante l'eliminazione")
			setDeleting(false)
			setDeleteOpen(false)
		}
	}

	if (loading) {
		return (
			<div className="min-h-[calc(100vh-64px)] flex items-center justify-center">
				<div className="text-center">
					<div className="animate-spin rounded-full h-10 w-10 border-b-2 border-purple-600 mx-auto mb-3" />
					<p className="text-gray-500 text-sm">Caricamento ordine…</p>
				</div>
			</div>
		)
	}

	if (!order) return null

	return (
		<div className="min-h-[calc(100vh-64px)]">
			<nav className="sticky top-14 z-40 h-12 bg-gray-800 text-white shadow-sm">
				<div className="container mx-auto flex items-center gap-2 px-4 md:px-6 pt-3">
					<button onClick={() => navigate("/admin/orders")} className="text-sm text-gray-300 hover:text-white transition-colors cursor-pointer flex items-center gap-1.5">
						<i className="fa-solid fa-arrow-left text-xs" />
						Ordini
					</button>
					<span className="text-gray-500">/</span>
					<span className="text-sm font-medium truncate">{order.coupleName}</span>
				</div>
			</nav>

			<div className="container mx-auto p-4 md:p-6 max-w-5xl">
				<div className="flex flex-col lg:flex-row gap-6">

					{/* ── Colonna sinistra: dati ordine ── */}
					<div className="flex-1 space-y-6">

						{/* Dati utente e progetto */}
						<div className="rounded-xl border border-gray-200 bg-white shadow-sm p-6">
							<h2 className="text-base font-semibold text-gray-800 mb-4">Info ordine</h2>
							<InfoRow label="ID" value={order.publicId} />
							<InfoRow label="Utente" value={order.userEmail} />
							<InfoRow label="Coppia" value={order.coupleName} />
							<InfoRow label="Matrimonio" value={order.weddingDate} />
							<InfoRow label="Telecamere" value={order.cameraCount} />
							<InfoRow label="Creato il" value={new Date(order.createdAt).toLocaleString("it-IT")} />
							<InfoRow label="Aggiornato il" value={new Date(order.updatedAt).toLocaleString("it-IT")} />
						</div>

						{/* Servizi */}
						<div className="rounded-xl border border-gray-200 bg-white shadow-sm p-6">
							<h2 className="text-base font-semibold text-gray-800 mb-4">Servizi selezionati</h2>
							{Array.isArray(order.selectedServices) && order.selectedServices.length > 0 ? (
								<div className="space-y-3">
									{order.selectedServices.map((s: SelectedService, i: number) => (
										<div key={i} className="py-2 border-b border-gray-100 last:border-0">
											<div className="flex flex-wrap items-center gap-2">
												<span className="text-xs font-mono bg-gray-100 text-gray-600 px-2 py-0.5 rounded">{s.publicId}</span>
												<span className="text-xs text-gray-500">{ORIENTATION_LABELS[s.orientation] ?? s.orientation}</span>
												{s.duration != null && <span className="text-xs text-gray-500">{s.duration} min</span>}
											</div>
											{s.notes && <p className="text-xs text-gray-500 italic mt-1">{s.notes}</p>}
										</div>
									))}
									<div className="flex justify-between items-center pt-2 text-sm font-semibold">
										{order.servicesTotal != null && (
											<>
												<span className="text-gray-500">Totale servizi</span>
												<span className="text-gray-700">€{Number(order.servicesTotal).toFixed(2)}</span>
											</>
										)}
									</div>
									{order.cameraSurcharge > 0 && (
										<div className="flex justify-between items-center text-sm">
											<span className="text-gray-500">Supplemento multi-camera</span>
											<span className="text-orange-600">+€{Number(order.cameraSurcharge).toFixed(2)}</span>
										</div>
									)}
									{order.totalPrice != null && (
										<div className="flex justify-between items-center text-sm font-bold border-t border-gray-200 pt-2">
											<span className="text-gray-800">Totale</span>
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
							{order.materialLink && <InfoRow label="Link materiale" value={order.materialLink} />}
							<InfoRow label="Dimensione" value={`${order.materialSizeGb} GB`} />
							{order.generalNotes && <InfoRow label="Note generali" value={order.generalNotes} />}
							{order.referenceVideo && <InfoRow label="Video riferimento" value={order.referenceVideo} />}
						</div>

						{/* Export */}
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

					{/* ── Colonna destra: azioni admin ── */}
					<div className="lg:w-80 shrink-0">
						<div className="lg:sticky lg:top-28 rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
							<div className="bg-gray-800 px-4 py-3">
								<h2 className="text-sm font-semibold text-white">Azioni amministratore</h2>
							</div>
							<div className="p-4 space-y-4">
								{/* Stato */}
								<div>
									<label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
										Stato ordine
									</label>
									<select
										value={adminStatus}
										onChange={(e) => setAdminStatus(e.target.value)}
										className={`block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-purple-500 focus:ring-1 focus:ring-purple-500 ${STATUS_CLASSES[adminStatus] ?? ""}`}
									>
										{STATUS_OPTIONS.map((o) => (
											<option key={o.value} value={o.value}>{o.label}</option>
										))}
									</select>
								</div>

								{/* Note admin */}
								<div>
									<label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
										Note per il cliente
									</label>
									<textarea
										value={adminNotes}
										onChange={(e) => setAdminNotes(e.target.value)}
										rows={4}
										placeholder="Inserisci note visibili al cliente…"
										className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-purple-500 focus:ring-1 focus:ring-purple-500 resize-none"
									/>
								</div>

								{/* Link consegna */}
								<div>
									<label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
										Link di consegna
									</label>
									<input
										type="url"
										value={deliveryLink}
										onChange={(e) => setDeliveryLink(e.target.value)}
										placeholder="https://…"
										className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
									/>
								</div>

								{/* Salva */}
								<button
									onClick={handleSave}
									disabled={saving}
									className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-purple-700 text-white text-sm font-medium hover:bg-purple-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer"
								>
									{saving ? (
										<><i className="fa-solid fa-spinner fa-spin" /> Salvataggio…</>
									) : (
										<><i className="fa-solid fa-floppy-disk" /> Salva modifiche</>
									)}
								</button>

								{/* Elimina */}
								<button
									onClick={() => setDeleteOpen(true)}
									className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg border border-red-200 text-red-600 text-sm font-medium hover:bg-red-50 transition-colors cursor-pointer"
								>
									<i className="fa-solid fa-trash" />
									Elimina ordine
								</button>
							</div>
						</div>
					</div>
				</div>
			</div>

			<DeleteModal
				isOpen={deleteOpen}
				onClose={() => setDeleteOpen(false)}
				onConfirm={handleDelete}
				title="Elimina ordine"
				description={`Sei sicuro di voler eliminare l'ordine di ${order.coupleName}? L'operazione è irreversibile.`}
				isLoading={deleting}
			/>
		</div>
	)
}

export default AdminOrderDetail
