import { useState, useEffect } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { toast } from "react-toastify"
import { genericGet, genericPatch, genericDelete } from "../../services/api-utility"

// ─── Tipi ────────────────────────────────────────────────────────────────────

interface StoredService {
	publicId: string
	name: string
	pricingType: "fixed" | "tiered" | "percentage"
	tierLabel?: string | null
	duration?: number | null
	price?: number | null
	percentageValue?: number | null
	notes?: string | null
}

interface OrderEntry {
	publicId: string
	coupleName: string
	weddingDate: string
	status: string
	adminNotes?: string | null
	deliveryLink?: string | null
	previewLink?: string | null
	userRevisionNotes?: string | null
	generalNotes?: string | null
	referenceVideo?: string | null
	// Per-entry service config
	selectedServices?: StoredService[] | string | null
	deliveryMethod?: "cloud_link" | "upload_request" | null
	materialLink?: string | null
	materialSizeGb?: number | null
	cameraCount?: "1-4" | "5-6" | "7+" | null
	exportFps?: string | null
	exportBitrate?: string | null
	exportAspect?: string | null
	exportResolution?: string | null
	servicesTotal?: number | null
	cameraSurcharge?: number | null
	packageDiscountPct?: number | null
	packageDiscountAmt?: number | null
	totalPrice?: number | null
}

interface Order {
	publicId: string
	coupleName: string
	weddingDate: string
	desiredDeliveryDate?: string | null
	entries?: OrderEntry[]
	deliveryMethod?: "cloud_link" | "upload_request" | null
	materialLink?: string | null
	materialSizeGb?: number | null
	cameraCount?: "1-4" | "5-6" | "7+" | null
	generalNotes?: string | null
	referenceVideo?: string | null
	exportFps?: string | null
	exportBitrate?: string | null
	exportAspect?: string | null
	exportResolution?: string | null
	selectedServices: StoredService[] | string
	servicesTotal?: number | null
	cameraSurcharge?: number | null
	quantityDiscountPct?: number | null
	quantityDiscountAmt?: number | null
	quantityUnitCount?: number | null
	totalPrice?: number | null
	status: "draft" | "pending" | "quote_ready" | "in_progress" | "under_review" | "awaiting_payment" | "completed" | "cancelled"
	adminNotes?: string | null
	deliveryLink?: string | null
	invoiceLink?: string | null
	proposedTotalPrice?: number | null
	createdAt: string
	updatedAt: string
}

// ─── Costanti ─────────────────────────────────────────────────────────────────

const CAMERA_OPTIONS: { value: string; label: string; surcharge: number }[] = [
	{ value: "1-4", label: "1 – 4", surcharge: 0   },
	{ value: "5-6", label: "5 – 6", surcharge: 50  },
	{ value: "7+",  label: "7 +",   surcharge: 100 },
]

const EXPORT_FPS_LABELS: Record<string, string> = {
	"25": "25 fps — PAL / Standard europeo",
	"30": "30 fps — NTSC / Web",
}
const EXPORT_BITRATE_LABELS: Record<string, string> = {
	"20": "20 Mbps — Qualità standard",
	"50": "50 Mbps — Alta qualità",
}
const EXPORT_ASPECT_LABELS: Record<string, string> = {
	"16:9": "16:9 — Widescreen",
	"9:16": "9:16 — Verticale / Social media",
}
const EXPORT_RESOLUTION_LABELS: Record<string, string> = {
	"1920x1080": "1080p — Full HD (1920 × 1080)",
	"3840x2160": "4K — Ultra HD (3840 × 2160)",
}

const STATUS_LABELS: Record<string, string> = {
	draft:            "Bozza",
	pending:          "In attesa di approvazione",
	quote_ready:      "Preventivo pronto",
	in_progress:      "In lavorazione",
	under_review:     "In revisione",
	awaiting_payment: "In attesa di pagamento",
	completed:        "Completato",
	cancelled:        "Annullato",
}

const STATUS_CLASSES: Record<string, string> = {
	draft:            "bg-gray-100 text-gray-500",
	pending:          "bg-yellow-100 text-yellow-800",
	quote_ready:      "bg-purple-100 text-purple-800",
	in_progress:      "bg-blue-100 text-blue-800",
	under_review:     "bg-orange-100 text-orange-800",
	awaiting_payment: "bg-amber-100 text-amber-800",
	completed:        "bg-green-100 text-green-800",
	cancelled:        "bg-gray-100 text-gray-600",
}

const ENTRY_STATUS_LABELS: Record<string, string> = {
	pending:           "In attesa",
	in_progress:       "In lavorazione",
	under_review:      "In revisione",
	revision_requested:"Revisione richiesta",
	revision_approved: "Approvato",
	completed:         "Completato",
	cancelled:         "Annullato",
}

const ENTRY_STATUS_CLASSES: Record<string, string> = {
	pending:           "bg-yellow-100 text-yellow-800",
	in_progress:       "bg-blue-100 text-blue-800",
	under_review:      "bg-orange-100 text-orange-800",
	revision_requested:"bg-red-100 text-red-700",
	revision_approved: "bg-green-100 text-green-700",
	completed:         "bg-green-100 text-green-800",
	cancelled:         "bg-gray-100 text-gray-600",
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
	if (!iso) return ""
	const d = new Date(iso)
	if (isNaN(d.getTime())) return iso
	return d.toLocaleDateString("it-IT", { day: "numeric", month: "long", year: "numeric" })
}

function formatDuration(minutes: number): string {
	const mins = Math.floor(minutes)
	const secs = Math.round((minutes - mins) * 60)
	if (secs === 0) return `${mins} min`
	return `${mins}min ${secs}s`
}

function parseServices(raw: StoredService[] | string | null | undefined): StoredService[] {
	if (!raw) return []
	if (Array.isArray(raw)) return raw
	if (typeof raw === "string") {
		try { return JSON.parse(raw) } catch { return [] }
	}
	return []
}

// ─── Componente ───────────────────────────────────────────────────────────────

const OrderDetail = () => {
	const navigate = useNavigate()
	const { publicId } = useParams<{ publicId: string }>()
	const [order, setOrder] = useState<Order | null>(null)
	const [loading, setLoading] = useState(true)
	const [openEntries, setOpenEntries] = useState<Set<string>>(new Set())
	const [revisionNotes, setRevisionNotes] = useState<Record<string, string>>({})
	const [actionLoading, setActionLoading] = useState(false)

	const toggleEntry = (id: string) =>
		setOpenEntries((prev) => {
			const next = new Set(prev)
			next.has(id) ? next.delete(id) : next.add(id)
			return next
		})

	const reloadOrder = () => {
		if (!publicId) return
		genericGet(`user/orders/${publicId}`)
			.then((data: Order) => setOrder(data))
			.catch(() => toast.error("Errore nel ricaricamento dell'ordine"))
	}

	useEffect(() => {
		if (!publicId) return
		genericGet(`user/orders/${publicId}`)
			.then((data: Order) => setOrder(data))
			.catch(() => {
				toast.error("Ordine non trovato o accesso negato")
				navigate("/user/dashboard")
			})
			.finally(() => setLoading(false))
	}, [publicId])

	const handleAcceptQuote = async () => {
		if (!order) return
		setActionLoading(true)
		try {
			await genericPatch(`user/orders/${order.publicId}`, { action: "accept_quote" })
			toast.success("Preventivo accettato!")
			reloadOrder()
		} catch { toast.error("Errore durante l'accettazione del preventivo") }
		finally { setActionLoading(false) }
	}

	const handleRejectQuote = async () => {
		if (!order) return
		setActionLoading(true)
		try {
			await genericPatch(`user/orders/${order.publicId}`, { action: "reject_quote" })
			toast.success("Preventivo rifiutato.")
			reloadOrder()
		} catch { toast.error("Errore durante il rifiuto del preventivo") }
		finally { setActionLoading(false) }
	}

	const handleDeleteDraft = async () => {
		if (!order) return
		setActionLoading(true)
		try {
			await genericDelete(`user/orders/${order.publicId}`)
			toast.success("Bozza eliminata.")
			navigate("/user/dashboard")
		} catch { toast.error("Errore durante l'eliminazione della bozza") }
		finally { setActionLoading(false) }
	}

	const handleSubmitDraft = async () => {
		if (!order) return
		setActionLoading(true)
		try {
			await genericPatch(`user/orders/${order.publicId}`, { action: "submit" })
			toast.success("Ordine inviato!")
			reloadOrder()
		} catch (err: any) {
			toast.error(err?.response?.data?.error?.message || "Errore durante l'invio dell'ordine")
		}
		finally { setActionLoading(false) }
	}

	const handleApproveEntry = async (entryPublicId: string) => {
		if (!order) return
		setActionLoading(true)
		try {
			await genericPatch(`user/orders/${order.publicId}/entries/${entryPublicId}`, { action: "approve" })
			toast.success("Entry approvata!")
			reloadOrder()
		} catch { toast.error("Errore durante l'approvazione") }
		finally { setActionLoading(false) }
	}

	const handleRequestRevision = async (entryPublicId: string) => {
		if (!order) return
		setActionLoading(true)
		try {
			await genericPatch(`user/orders/${order.publicId}/entries/${entryPublicId}`, {
				action: "request_revision",
				notes: revisionNotes[entryPublicId] || "",
			})
			toast.success("Revisione richiesta.")
			reloadOrder()
		} catch { toast.error("Errore durante la richiesta di revisione") }
		finally { setActionLoading(false) }
	}

	if (loading) {
		return (
			<div className="min-h-[calc(100vh-3.5rem)] flex items-center justify-center">
				<div className="text-center">
					<div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#7c3aed] mx-auto mb-3" />
					<p className="text-gray-500 text-sm">Caricamento ordine…</p>
				</div>
			</div>
		)
	}

	if (!order) return null

	const isBatch = order.entries && order.entries.length > 1

	const services = parseServices(order.selectedServices)
	const mainServices     = services.filter((s) => s.pricingType !== "percentage")
	const deliveryServices = services.filter((s) => s.pricingType === "percentage")

	const cameraSurcharge = Number(order.cameraSurcharge ?? 0)
	const totalPrice      = order.totalPrice != null ? Number(order.totalPrice) : null

	return (
		<div className="min-h-[calc(100vh-3.5rem)] relative">
			<div className="container mx-auto px-4 py-6 md:py-8 relative">

				{/* Intestazione */}
				<div className="flex flex-wrap items-center gap-3 mb-6">
					<button
						onClick={() => navigate("/user/dashboard")}
						className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition-colors cursor-pointer"
					>
						<i className="fa-solid fa-arrow-left" />
						Progetti
					</button>
					<span className="text-gray-300">/</span>
					<h1 className="text-xl font-bold text-gray-800">{order.coupleName || "Bozza"}</h1>
				</div>

				{/* Banner azioni per stato ordine */}
				{order.status === "draft" && (
					<div className="mb-6 bg-gray-50 border border-gray-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
						<div>
							<p className="font-medium text-gray-700">Questo ordine è una bozza.</p>
							<p className="text-sm text-gray-500 mt-0.5">Completalo e invialo quando è pronto.</p>
						</div>
						<div className="flex gap-2 shrink-0">
							<button
								onClick={handleDeleteDraft}
								disabled={actionLoading}
								className="px-4 py-2 border border-red-300 text-red-600 rounded-lg text-sm font-medium hover:bg-red-50 disabled:opacity-50 cursor-pointer transition-colors"
							>
								<i className="fa-solid fa-trash mr-1.5" />
								Elimina bozza
							</button>
							<button
								onClick={handleSubmitDraft}
								disabled={actionLoading}
								className="px-4 py-2 bg-[#7c3aed] text-white rounded-lg text-sm font-medium hover:bg-[#6d28d9] disabled:opacity-50 cursor-pointer transition-colors"
							>
								<i className="fa-solid fa-paper-plane mr-1.5" />
								Invia ordine
							</button>
						</div>
					</div>
				)}

				{order.status === "quote_ready" && (
					<div className="mb-6 bg-purple-50 border border-purple-200 rounded-xl p-4">
						<div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
							<div>
								<p className="font-semibold text-purple-900">Preventivo ricevuto</p>
								<div className="flex flex-wrap gap-4 mt-1 text-sm text-purple-700">
									{order.proposedTotalPrice != null && (
										<span><i className="fa-solid fa-euro-sign mr-1" />Prezzo proposto: <strong>€{Number(order.proposedTotalPrice).toFixed(2)}</strong></span>
									)}
									{order.desiredDeliveryDate && (
										<span><i className="fa-solid fa-calendar mr-1" />Consegna stimata: <strong>{formatDate(order.desiredDeliveryDate)}</strong></span>
									)}
								</div>
							</div>
							<div className="flex gap-2 shrink-0">
								<button
									onClick={handleRejectQuote}
									disabled={actionLoading}
									className="px-4 py-2 border border-red-300 text-red-600 rounded-lg text-sm font-medium hover:bg-red-50 disabled:opacity-50 cursor-pointer transition-colors"
								>
									Rifiuta
								</button>
								<button
									onClick={handleAcceptQuote}
									disabled={actionLoading}
									className="px-4 py-2 bg-[#7c3aed] text-white rounded-lg text-sm font-medium hover:bg-[#6d28d9] disabled:opacity-50 cursor-pointer transition-colors"
								>
									Accetta preventivo
								</button>
							</div>
						</div>
					</div>
				)}

				{order.status === "awaiting_payment" && (
					<div className="mb-6 bg-amber-50 border border-amber-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
						<div>
							<p className="font-semibold text-amber-800">In attesa di pagamento</p>
							<p className="text-sm text-amber-700 mt-0.5">Scarica la fattura e procedi con il pagamento.</p>
						</div>
						{order.invoiceLink && (
							<a
								href={order.invoiceLink}
								target="_blank"
								rel="noopener noreferrer"
								className="inline-flex items-center gap-2 px-4 py-2 bg-amber-500 text-white rounded-lg text-sm font-medium hover:bg-amber-600 transition-colors shrink-0"
							>
								<i className="fa-solid fa-file-invoice" />
								Visualizza fattura
							</a>
						)}
					</div>
				)}

				<div className="flex flex-col lg:flex-row gap-8">

					{/* ── Colonna sinistra ── */}
					<section className="flex-1 max-w-4xl space-y-6">

						{/* Banner aggiornamenti admin */}
						{order.entries && order.entries.length > 0 ? (
							// Se ci sono entries, mostra aggiornamenti per-entry
							order.entries.some((e) => e.adminNotes || (order.status === "completed" && e.deliveryLink)) && (
								<div className="rounded-xl border border-[#ddd6fe] bg-[#f5f3ff] shadow-sm p-6 space-y-4">
									<h2 className="text-base font-semibold text-[#6d28d9]">
										<i className="fa-solid fa-circle-info mr-2" />
										Aggiornamenti dal team
									</h2>
									{order.entries.filter((e) => e.adminNotes || e.deliveryLink).map((e) => (
										<div key={e.publicId} className="space-y-3 border-t border-[#ddd6fe] pt-3 first:border-0 first:pt-0">
											<p className="text-xs font-semibold text-[#7c3aed] uppercase tracking-wide">{e.coupleName}</p>
											{e.adminNotes && (
												<div>
													<p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Note</p>
													<p className="text-sm text-gray-700 whitespace-pre-wrap">{e.adminNotes}</p>
												</div>
											)}
											{order.status === "completed" && e.deliveryLink && (
												<a href={e.deliveryLink} target="_blank" rel="noopener noreferrer"
													className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-green-600 text-white text-sm font-medium hover:bg-green-700 transition-colors"
												>
													<i className="fa-solid fa-download" />
													Scarica video — {e.coupleName}
												</a>
											)}
										</div>
									))}
								</div>
							)
						) : (
							(order.adminNotes || (order.status === "completed" && order.deliveryLink)) && (
								<div className="rounded-xl border border-[#ddd6fe] bg-[#f5f3ff] shadow-sm p-6 space-y-4">
									<h2 className="text-base font-semibold text-[#6d28d9]">
										<i className="fa-solid fa-circle-info mr-2" />
										Aggiornamenti dal team
									</h2>
									{order.adminNotes && (
										<div>
											<p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Note</p>
											<p className="text-sm text-gray-700 whitespace-pre-wrap">{order.adminNotes}</p>
										</div>
									)}
									{order.status === "completed" && order.deliveryLink && (
										<a href={order.deliveryLink} target="_blank" rel="noopener noreferrer"
											className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-green-600 text-white text-sm font-medium hover:bg-green-700 transition-colors"
										>
											<i className="fa-solid fa-download" />
											Scarica video
										</a>
									)}
								</div>
							)
						)}

						{/* Intestazione progetto */}
						<div className="rounded-xl border border-gray-200 bg-white shadow-sm p-6 md:p-8 space-y-6">
							<div className="flex flex-wrap items-center gap-3">
								<h2 className="text-2xl font-bold text-[#6d28d9]">{order.coupleName}</h2>
								<span className={`inline-flex items-center text-xs font-semibold px-2.5 py-1 rounded-full ${STATUS_CLASSES[order.status] ?? "bg-gray-100 text-gray-600"}`}>
									{STATUS_LABELS[order.status] ?? order.status}
								</span>
							</div>
							{(!order.entries || order.entries.length <= 1) && (
								<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
									<div>
										<p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Data del matrimonio</p>
										<p className="text-sm font-medium text-gray-800">{formatDate(order.weddingDate)}</p>
									</div>
									{order.desiredDeliveryDate && (
										<div>
											<p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Data di consegna desiderata</p>
											<p className="text-sm font-medium text-gray-800">{formatDate(order.desiredDeliveryDate)}</p>
										</div>
									)}
								</div>
							)}
						</div>

						{/* Matrimoni inclusi (solo batch) — accordion per-entry */}
						{isBatch && order.entries && (
							<div className="rounded-xl border border-gray-200 bg-white shadow-sm p-6 md:p-8 space-y-4">
								<div>
									<h2 className="text-lg font-semibold text-gray-900">Matrimoni inclusi</h2>
									<p className="text-sm text-gray-500 mt-0.5">{order.entries.length} matrimoni in questo ordine.</p>
								</div>
								<div className="space-y-3">
									{order.entries.map((entry) => {
										const isOpen = openEntries.has(entry.publicId)
										const entrySvcs = parseServices((entry.selectedServices ?? null) as StoredService[] | string | null)
										const entryMainSvcs = entrySvcs.filter((s) => s.pricingType !== "percentage")
										const entryDeliverySvcs = entrySvcs.filter((s) => s.pricingType === "percentage")
										const entryTot = entry.totalPrice != null ? Number(entry.totalPrice) : null
										const hasExport = entry.exportFps || entry.exportBitrate || entry.exportAspect || entry.exportResolution
										return (
											<div key={entry.publicId} className="rounded-lg border border-gray-200 overflow-hidden">
												{/* Header — cliccabile */}
												<button
													type="button"
													onClick={() => toggleEntry(entry.publicId)}
													className="w-full flex items-center gap-3 px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors text-left cursor-pointer"
												>
													<div className="flex-1 min-w-0">
														<p className="font-semibold text-gray-900 text-sm">{entry.coupleName}</p>
														<p className="text-xs text-gray-500 mt-0.5">
															<i className="fa-solid fa-ring text-[9px] mr-1 text-[#a78bfa]" aria-hidden />
															{formatDate(entry.weddingDate)}
														</p>
													</div>
													{entryTot != null && (
														<span className="text-sm font-bold text-[#7c3aed] shrink-0">€{entryTot.toFixed(2)}</span>
													)}
													<i className={`fa-solid fa-chevron-${isOpen ? "up" : "down"} text-xs text-gray-400 shrink-0`} aria-hidden />
												</button>

												{/* Corpo accordion */}
												{isOpen && (
													<div className="px-4 py-4 space-y-5 border-t border-gray-100">

														{/* Servizi */}
														{entrySvcs.length > 0 ? (
															<div className="space-y-4">
																<p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Servizi</p>

																{entryMainSvcs.length > 0 && (
																	<div className="space-y-2">
																		{entryMainSvcs.map((svc) => (
																			<div key={svc.publicId} className="rounded-lg border border-[#ddd6fe] bg-[#f5f3ff] p-3">
																				<div className="flex items-start gap-2">
																					<i className="fa-solid fa-circle-check text-[#7c3aed] mt-0.5 shrink-0" aria-hidden />
																					<div className="flex-1 min-w-0">
																						<span className="font-semibold text-gray-900 text-sm">{svc.name}</span>
																						{svc.tierLabel && (
																							<p className="text-xs text-[#6d28d9] mt-0.5">
																								{svc.tierLabel}
																								{svc.duration != null && ` · ${formatDuration(svc.duration)}`}
																							</p>
																						)}
																						{svc.pricingType === "fixed" && svc.price != null && (
																							<p className="text-xs font-semibold text-[#6d28d9] mt-0.5">€{Number(svc.price).toFixed(2)}</p>
																						)}
																						{svc.notes && (
																							<p className="text-xs text-gray-600 mt-1 bg-white rounded border border-gray-200 px-2 py-1">{svc.notes}</p>
																						)}
																					</div>
																				</div>
																			</div>
																		))}
																	</div>
																)}

																{entryDeliverySvcs.length > 0 && (
																	<div className="space-y-2">
																		{entryDeliverySvcs.map((svc) => (
																			<div key={svc.publicId} className="rounded-lg border border-[#ddd6fe] bg-[#f5f3ff] p-3">
																				<div className="flex items-start gap-2">
																					<i className="fa-solid fa-circle-check text-[#7c3aed] mt-0.5 shrink-0" aria-hidden />
																					<div className="flex-1">
																						<span className="font-semibold text-gray-900 text-sm">{svc.name}</span>
																						<p className="text-xs text-[#6d28d9] mt-0.5">
																							+{svc.percentageValue}%
																							{svc.price != null && svc.price > 0 && ` = €${Number(svc.price).toFixed(2)}`}
																						</p>
																					</div>
																				</div>
																			</div>
																		))}
																	</div>
																)}

																{entry.cameraSurcharge != null && Number(entry.cameraSurcharge) > 0 && (
																	<div className="flex justify-between items-center text-sm py-1">
																		<span className="text-gray-500 text-xs">Supplemento multi-camera ({entry.cameraCount})</span>
																		<span className="font-medium text-orange-600 text-xs">+€{Number(entry.cameraSurcharge).toFixed(2)}</span>
																	</div>
																)}
																{entry.packageDiscountAmt != null && Number(entry.packageDiscountAmt) > 0 && (
																	<div className="flex justify-between items-center text-sm py-1">
																		<span className="text-gray-500 text-xs">
																			Sconto pacchetto
																			{entry.packageDiscountPct != null && ` (-${Number(entry.packageDiscountPct)}%)`}
																		</span>
																		<span className="font-medium text-green-600 text-xs">-€{Number(entry.packageDiscountAmt).toFixed(2)}</span>
																	</div>
																)}
															</div>
														) : (
															<p className="text-xs text-gray-400 italic">Nessun servizio.</p>
														)}

														{/* Materiale */}
														{(entry.deliveryMethod || entry.materialSizeGb != null) && (
															<div className="space-y-2">
																<p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Materiale</p>
																<div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
																	{(["cloud_link", "upload_request"] as const).map((method) => {
																		const active = entry.deliveryMethod === method
																		const icon = method === "cloud_link" ? "fa-cloud" : "fa-cloud-arrow-up"
																		const title = method === "cloud_link" ? "Ho già caricato il materiale" : "Richiedi link di caricamento"
																		return (
																			<div key={method} className={`flex items-center gap-2 p-3 rounded-lg border-2 text-sm ${active ? "border-[#7c3aed] bg-[#f5f3ff]" : "border-gray-200 opacity-40"}`}>
																				<i className={`fa-solid ${icon} ${active ? "text-[#7c3aed]" : "text-gray-400"}`} aria-hidden />
																				<span className={active ? "text-[#6d28d9] font-medium" : "text-gray-600"}>{title}</span>
																			</div>
																		)
																	})}
																</div>
																{entry.deliveryMethod === "cloud_link" && entry.materialLink && (
																	<div>
																		<p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Link cartella cloud</p>
																		<a href={entry.materialLink} target="_blank" rel="noopener noreferrer" className="text-sm text-[#7c3aed] underline break-all">{entry.materialLink}</a>
																	</div>
																)}
																{entry.materialSizeGb != null && (
																	<p className="text-sm text-gray-700">
																		<span className="font-medium">Dimensione:</span> {entry.materialSizeGb} GB
																	</p>
																)}
															</div>
														)}

														{/* Telecamere */}
														{entry.cameraCount && (
															<div className="space-y-2">
																<p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Telecamere</p>
																<div className="flex gap-2">
																	{CAMERA_OPTIONS.map((opt) => {
																		const active = entry.cameraCount === opt.value
																		return (
																			<div key={opt.value} className={`flex flex-col items-center gap-1 px-4 py-2 rounded-lg border-2 text-center ${active ? "border-[#7c3aed] bg-[#f5f3ff]" : "border-gray-200 opacity-40"}`}>
																				<i className={`fa-solid fa-video text-lg ${active ? "text-[#7c3aed]" : "text-gray-400"}`} aria-hidden />
																				<span className={`font-semibold text-sm ${active ? "text-[#6d28d9]" : "text-gray-900"}`}>{opt.label}</span>
																				{opt.surcharge > 0
																					? <span className={`text-xs ${active ? "text-[#7c3aed]" : "text-orange-500"}`}>+€{opt.surcharge}</span>
																					: <span className="text-xs text-gray-400">Incluso</span>
																				}
																			</div>
																		)
																	})}
																</div>
															</div>
														)}

														{/* Esportazione */}
														{hasExport && (
															<div className="space-y-2">
																<p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Esportazione</p>
																<div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
																	{entry.exportFps && (
																		<div>
																			<p className="text-xs text-gray-400 mb-0.5">FPS</p>
																			<p className="font-medium text-gray-800">{EXPORT_FPS_LABELS[entry.exportFps] ?? entry.exportFps}</p>
																		</div>
																	)}
																	{entry.exportBitrate && (
																		<div>
																			<p className="text-xs text-gray-400 mb-0.5">Bitrate</p>
																			<p className="font-medium text-gray-800">{EXPORT_BITRATE_LABELS[entry.exportBitrate] ?? entry.exportBitrate}</p>
																		</div>
																	)}
																	{entry.exportAspect && (
																		<div>
																			<p className="text-xs text-gray-400 mb-0.5">Formato</p>
																			<p className="font-medium text-gray-800">{EXPORT_ASPECT_LABELS[entry.exportAspect] ?? entry.exportAspect}</p>
																		</div>
																	)}
																	{entry.exportResolution && (
																		<div>
																			<p className="text-xs text-gray-400 mb-0.5">Risoluzione</p>
																			<p className="font-medium text-gray-800">{EXPORT_RESOLUTION_LABELS[entry.exportResolution] ?? entry.exportResolution}</p>
																		</div>
																	)}
																</div>
															</div>
														)}

														{/* Totale entry */}
														{entryTot != null && (
															<div className="border-t border-gray-100 pt-3 flex justify-between font-semibold text-sm">
																<span className="text-gray-700">Totale matrimonio</span>
																<span className="text-[#7c3aed]">€{entryTot.toFixed(2)}</span>
															</div>
														)}

														{/* Note per-entry */}
								{(entry.generalNotes || entry.referenceVideo) && (
									<div className="border-t border-gray-100 pt-4 space-y-3">
										{entry.generalNotes && (
											<div>
												<p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Note generali</p>
												<p className="text-sm text-gray-700 whitespace-pre-wrap bg-gray-50 rounded-lg border border-gray-100 p-3">{entry.generalNotes}</p>
											</div>
										)}
										{entry.referenceVideo && (
											<div>
												<p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Video di riferimento</p>
												<p className="text-sm text-gray-700 whitespace-pre-wrap bg-gray-50 rounded-lg border border-gray-100 p-3">{entry.referenceVideo}</p>
											</div>
										)}
									</div>
								)}

								{/* Sezione revisione preview */}
														{entry.previewLink && (
															<div className="border-t border-gray-200 pt-4 space-y-3">
																<div className="flex items-center justify-between">
																	<p className="text-sm font-semibold text-gray-700">
																		<i className="fa-solid fa-film mr-1.5 text-[#7c3aed]" />
																		Preview caricata
																	</p>
																	<a
																		href={entry.previewLink}
																		target="_blank"
																		rel="noopener noreferrer"
																		className="text-sm text-[#7c3aed] underline underline-offset-2 hover:text-[#6d28d9]"
																	>
																		Guarda preview
																	</a>
																</div>
																{entry.status === "under_review" && (
																	<div className="space-y-2">
																		<textarea
																			value={revisionNotes[entry.publicId] || ""}
																			onChange={(ev) => setRevisionNotes((p) => ({ ...p, [entry.publicId]: ev.target.value }))}
																			placeholder="Note per la revisione (opzionale)"
																			rows={2}
																			className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-[#7c3aed] focus:border-transparent"
																		/>
																		<div className="flex gap-2">
																			<button
																				type="button"
																				onClick={() => handleRequestRevision(entry.publicId)}
																				disabled={actionLoading}
																				className="px-3 py-1.5 border border-orange-400 text-orange-600 rounded-lg text-xs font-medium hover:bg-orange-50 disabled:opacity-50 cursor-pointer transition-colors"
																			>
																				<i className="fa-solid fa-rotate-left mr-1" />
																				Richiedi revisione
																			</button>
																			<button
																				type="button"
																				onClick={() => handleApproveEntry(entry.publicId)}
																				disabled={actionLoading}
																				className="px-3 py-1.5 bg-green-600 text-white rounded-lg text-xs font-medium hover:bg-green-700 disabled:opacity-50 cursor-pointer transition-colors"
																			>
																				<i className="fa-solid fa-check mr-1" />
																				Approva
																			</button>
																		</div>
																	</div>
																)}
																{entry.status === "revision_requested" && (
																	<div className="bg-orange-50 border border-orange-200 rounded-lg p-3 text-xs text-orange-700">
																		<i className="fa-solid fa-clock mr-1" />
																		<span className="font-medium">Revisione richiesta</span>
																		{entry.userRevisionNotes && (
																			<p className="mt-1 text-orange-600">"{entry.userRevisionNotes}"</p>
																		)}
																	</div>
																)}
																{entry.status === "revision_approved" && (
																	<div className="bg-green-50 border border-green-200 rounded-lg p-3 text-xs text-green-700 font-medium">
																		<i className="fa-solid fa-circle-check mr-1" />
																		Approvato
																	</div>
																)}
															</div>
														)}
													</div>
												)}
											</div>
										)
									})}
								</div>
							</div>
						)}

						{/* Servizi (solo ordini singoli — per batch i servizi sono per-entry sopra) */}
						{!isBatch && <div className="rounded-xl border border-gray-200 bg-white shadow-sm p-6 md:p-8 space-y-4">
							<div>
								<h2 className="text-lg font-semibold text-gray-900">Servizi</h2>
								<p className="text-sm text-gray-500 mt-0.5">I servizi inclusi in questo progetto.</p>
							</div>

							{services.length === 0 ? (
								<p className="text-sm text-gray-400 italic py-4">Nessun servizio selezionato.</p>
							) : (
								<div className="space-y-6">

									{/* Servizi principali + extra */}
									{mainServices.length > 0 && (
										<div className="space-y-3">
											{mainServices.map((svc) => (
												<div key={svc.publicId} className="rounded-xl border-2 border-[#7c3aed] bg-[#f5f3ff] p-4">
													<div className="flex items-start gap-3">
														<i className="fa-solid fa-circle-check text-[#7c3aed] mt-0.5 text-lg shrink-0" aria-hidden />
														<div className="flex-1 min-w-0">
															<span className="font-semibold text-gray-900">{svc.name}</span>

															{/* Fascia selezionata */}
															{svc.tierLabel && (
																<div className="mt-3 space-y-2">
																	<p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Fascia selezionata</p>
																	<span className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border-2 border-[#7c3aed] bg-[#7c3aed] text-white text-sm">
																		<span>{svc.tierLabel}</span>
																		{svc.price != null && (
																			<span className="font-bold text-white">€{Number(svc.price).toFixed(2)}</span>
																		)}
																	</span>
																	{svc.duration != null && (
																		<p className="text-xs text-[#6d28d9] font-medium mt-1">
																			<i className="fa-solid fa-clock mr-1" />
																			Durata stimata: {formatDuration(svc.duration)}
																		</p>
																	)}
																</div>
															)}

															{/* Prezzo fisso */}
															{svc.pricingType === "fixed" && svc.price != null && (
																<p className="mt-2 text-sm font-semibold text-[#6d28d9]">
																	€{Number(svc.price).toFixed(2)}
																</p>
															)}

															{/* Note */}
															{svc.notes && (
																<div className="mt-3">
																	<p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Specifiche aggiuntive</p>
																	<p className="text-sm text-gray-700 bg-white rounded-lg border border-gray-200 p-2">{svc.notes}</p>
																</div>
															)}
														</div>
													</div>
												</div>
											))}
										</div>
									)}

									{/* Consegna rapida */}
									{deliveryServices.length > 0 && (
										<div className="space-y-3">
											<div className="flex items-center gap-3">
												<div className="h-px flex-1 bg-gray-100" />
												<span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Consegna</span>
												<div className="h-px flex-1 bg-gray-100" />
											</div>
											{deliveryServices.map((svc) => (
												<div key={svc.publicId} className="rounded-xl border-2 border-[#7c3aed] bg-[#f5f3ff] p-4">
													<div className="flex items-start gap-3">
														<i className="fa-solid fa-circle-check text-[#7c3aed] mt-0.5 text-lg shrink-0" aria-hidden />
														<div className="flex-1">
															<span className="font-semibold text-gray-900">{svc.name}</span>
															<p className="mt-1 text-sm text-[#6d28d9]">
																<span className="font-semibold">+{svc.percentageValue}%</span>
																{svc.price != null && svc.price > 0 && (
																	<span className="text-gray-500 ml-1">= €{Number(svc.price).toFixed(2)}</span>
																)}
															</p>
															{svc.notes && (
																<p className="mt-2 text-sm text-gray-700 bg-white rounded-lg border border-gray-200 p-2">{svc.notes}</p>
															)}
														</div>
													</div>
												</div>
											))}
										</div>
									)}

								</div>
							)}
						</div>}

						{/* Materiale (solo ordini singoli) */}
						{!isBatch && <div className="rounded-xl border border-gray-200 bg-white shadow-sm p-6 md:p-8 space-y-4">
							<div>
								<h2 className="text-lg font-semibold text-gray-900">Materiale</h2>
								<p className="text-sm text-gray-500 mt-0.5">Modalità di consegna del materiale video.</p>
							</div>
							<div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
								{(["cloud_link", "upload_request"] as const).map((method) => {
									const active = order.deliveryMethod === method
									const icon  = method === "cloud_link" ? "fa-cloud" : "fa-cloud-arrow-up"
									const title = method === "cloud_link" ? "Ho già caricato il materiale" : "Richiedi link di caricamento"
									const desc  = method === "cloud_link"
										? "Fornisci il link alla cartella cloud con tutti i file."
										: "Ti invieremo un link dove potrai caricare il materiale."
									return (
										<div
											key={method}
											className={`flex items-start gap-3 p-4 rounded-lg border-2 ${active ? "border-[#7c3aed] bg-[#f5f3ff]" : "border-gray-200 bg-white opacity-40"}`}
										>
											<i className={`fa-solid ${icon} text-xl mt-0.5 shrink-0 ${active ? "text-[#7c3aed]" : "text-gray-400"}`} aria-hidden />
											<div>
												<p className={`font-medium ${active ? "text-[#6d28d9]" : "text-gray-900"}`}>{title}</p>
												<p className="text-sm text-gray-500 mt-0.5">{desc}</p>
											</div>
										</div>
									)
								})}
							</div>
							{order.deliveryMethod === "cloud_link" && order.materialLink && (
								<div>
									<p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Link cartella cloud</p>
									<a href={order.materialLink} target="_blank" rel="noopener noreferrer" className="text-sm text-[#7c3aed] underline break-all">{order.materialLink}</a>
								</div>
							)}
							{order.materialSizeGb != null && (
								<div>
									<p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Dimensione totale materiale</p>
									<p className="text-sm font-medium text-gray-800">{order.materialSizeGb} GB</p>
								</div>
							)}
						</div>}

						{/* Note (ordini singoli — lette dalla prima entry) */}
						{!isBatch && (() => {
							const firstEntry = order.entries?.[0]
							const notes = firstEntry?.generalNotes || order.generalNotes
							const refVideo = firstEntry?.referenceVideo || order.referenceVideo
							return (notes || refVideo) ? (
								<div className="rounded-xl border border-gray-200 bg-white shadow-sm p-6 md:p-8 space-y-4">
									<h2 className="text-lg font-semibold text-gray-900">Note</h2>
									{notes && (
										<div>
											<p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Note generali</p>
											<p className="text-sm text-gray-700 whitespace-pre-wrap bg-gray-50 rounded-lg border border-gray-100 p-3">{notes}</p>
										</div>
									)}
									{refVideo && (
										<div>
											<p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Video di riferimento</p>
											<p className="text-sm text-gray-700 whitespace-pre-wrap bg-gray-50 rounded-lg border border-gray-100 p-3">{refVideo}</p>
										</div>
									)}
								</div>
							) : null
						})()}

						{/* Telecamere (solo ordini singoli) */}
						{!isBatch && <div className="rounded-xl border border-gray-200 bg-white shadow-sm p-6 md:p-8 space-y-4">
							<div>
								<h2 className="text-lg font-semibold text-gray-900">Telecamere</h2>
								<p className="text-sm text-gray-500 mt-0.5">Numero di telecamere utilizzate nel giorno del matrimonio.</p>
							</div>
							<div className="grid grid-cols-3 gap-3">
								{CAMERA_OPTIONS.map((opt) => {
									const active = order.cameraCount === opt.value
									return (
										<div
											key={opt.value}
											className={`flex flex-col items-center gap-2 p-4 rounded-lg border-2 text-center ${active ? "border-[#7c3aed] bg-[#f5f3ff]" : "border-gray-200 bg-white opacity-40"}`}
										>
											<i className={`fa-solid fa-video text-2xl ${active ? "text-[#7c3aed]" : "text-gray-400"}`} aria-hidden />
											<span className={`font-semibold text-lg ${active ? "text-[#6d28d9]" : "text-gray-900"}`}>{opt.label}</span>
											{opt.surcharge > 0
												? <span className={`text-xs font-medium ${active ? "text-[#7c3aed]" : "text-orange-500"}`}>+€{opt.surcharge}</span>
												: <span className="text-xs text-gray-400">Incluso</span>
											}
										</div>
									)
								})}
							</div>
						</div>}

						{/* Impostazioni esportazione (solo ordini singoli) */}
						{/* Revisione preview (ordini singoli) */}
						{!isBatch && order.entries && order.entries[0]?.previewLink && (
							<div className="rounded-xl border border-orange-200 bg-orange-50 shadow-sm p-6 space-y-4">
								<h2 className="text-base font-semibold text-orange-900">
									<i className="fa-solid fa-film mr-2" />
									Preview caricata
								</h2>
								<div className="flex items-center justify-between">
									<span className="text-sm text-orange-700">Guarda la preview e comunicaci il tuo feedback.</span>
									<a
										href={order.entries[0].previewLink}
										target="_blank"
										rel="noopener noreferrer"
										className="text-sm text-[#7c3aed] underline underline-offset-2 hover:text-[#6d28d9]"
									>
										Guarda preview
									</a>
								</div>
								{order.entries[0].status === "under_review" && (
									<div className="space-y-2">
										<textarea
											value={revisionNotes[order.entries[0].publicId] || ""}
											onChange={(ev) => setRevisionNotes((p) => ({ ...p, [order.entries![0].publicId]: ev.target.value }))}
											placeholder="Note per la revisione (opzionale)"
											rows={2}
											className="w-full text-sm border border-orange-300 bg-white rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-[#7c3aed] focus:border-transparent"
										/>
										<div className="flex gap-2">
											<button
												type="button"
												onClick={() => handleRequestRevision(order.entries![0].publicId)}
												disabled={actionLoading}
												className="px-4 py-2 border border-orange-400 text-orange-600 rounded-lg text-sm font-medium hover:bg-orange-100 disabled:opacity-50 cursor-pointer transition-colors"
											>
												<i className="fa-solid fa-rotate-left mr-1.5" />
												Richiedi revisione
											</button>
											<button
												type="button"
												onClick={() => handleApproveEntry(order.entries![0].publicId)}
												disabled={actionLoading}
												className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50 cursor-pointer transition-colors"
											>
												<i className="fa-solid fa-check mr-1.5" />
												Approva
											</button>
										</div>
									</div>
								)}
								{order.entries[0].status === "revision_requested" && (
									<div className="bg-white border border-orange-200 rounded-lg p-3 text-sm text-orange-700">
										<i className="fa-solid fa-clock mr-1" />
										<span className="font-medium">Revisione richiesta</span>
										{order.entries[0].userRevisionNotes && (
											<p className="mt-1 text-orange-600 text-xs">"{order.entries[0].userRevisionNotes}"</p>
										)}
									</div>
								)}
								{order.entries[0].status === "revision_approved" && (
									<div className="bg-green-50 border border-green-200 rounded-lg p-3 text-sm text-green-700 font-medium">
										<i className="fa-solid fa-circle-check mr-1" />
										Approvato
									</div>
								)}
							</div>
						)}

						{!isBatch && (order.exportFps || order.exportBitrate || order.exportAspect || order.exportResolution) && (
							<div className="rounded-xl border border-gray-200 bg-white shadow-sm p-6 md:p-8 space-y-4">
								<div>
									<h2 className="text-lg font-semibold text-gray-900">Impostazioni di esportazione</h2>
									<p className="text-sm text-gray-500 mt-0.5">Formato tecnico richiesto per i file finali.</p>
								</div>
								<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
									{order.exportFps && (
										<div>
											<p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Frame rate (FPS)</p>
											<p className="text-sm font-medium text-gray-800">{EXPORT_FPS_LABELS[order.exportFps] ?? order.exportFps}</p>
										</div>
									)}
									{order.exportBitrate && (
										<div>
											<p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Bitrate (Mbps)</p>
											<p className="text-sm font-medium text-gray-800">{EXPORT_BITRATE_LABELS[order.exportBitrate] ?? order.exportBitrate}</p>
										</div>
									)}
									{order.exportAspect && (
										<div>
											<p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Formato (aspect ratio)</p>
											<p className="text-sm font-medium text-gray-800">{EXPORT_ASPECT_LABELS[order.exportAspect] ?? order.exportAspect}</p>
										</div>
									)}
									{order.exportResolution && (
										<div>
											<p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Risoluzione</p>
											<p className="text-sm font-medium text-gray-800">{EXPORT_RESOLUTION_LABELS[order.exportResolution] ?? order.exportResolution}</p>
										</div>
									)}
								</div>
							</div>
						)}

					</section>

					{/* ── Colonna destra: riepilogo ── */}
					<aside className="lg:w-80 shrink-0">
						<div className="lg:sticky lg:top-24 rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
							<div className="bg-[#ede9fe] px-4 py-3 border-b border-[#ddd6fe]">
								<h2 className="text-lg font-semibold text-[#6d28d9]">Riepilogo</h2>
							</div>
							<div className="p-4 space-y-3">
								{isBatch && order.entries ? (
									// Riepilogo batch: lista per matrimonio
									<>
										{order.entries.map((e) => (
											<div key={e.publicId} className="flex justify-between items-start text-sm gap-2">
												<div>
													<span className="font-medium text-gray-700">{e.coupleName}</span>
													<span className="block text-xs text-gray-400">{formatDate(e.weddingDate)}</span>
												</div>
												<span className="font-semibold text-gray-900 shrink-0">
													{e.totalPrice != null ? `€${Number(e.totalPrice).toFixed(2)}` : "—"}
												</span>
											</div>
										))}
										{order.quantityDiscountAmt != null && Number(order.quantityDiscountAmt) > 0 && (
											<div className="flex justify-between items-center text-sm gap-2 text-green-700">
												<span>
													Sconto quantità{order.quantityDiscountPct != null && ` (-${Number(order.quantityDiscountPct)}%)`}
													{order.quantityUnitCount != null && ` · ${order.quantityUnitCount} unità`}
												</span>
												<span className="font-medium shrink-0">-€{Number(order.quantityDiscountAmt).toFixed(2)}</span>
											</div>
										)}
										<div className="border-t border-gray-200 pt-3 flex justify-between font-bold text-base">
											<span className="text-gray-800">Totale</span>
											<span className="text-[#7c3aed]">
												{totalPrice != null ? `€${totalPrice.toFixed(2)}` : <em className="font-normal text-gray-400 text-sm">Da definire</em>}
											</span>
										</div>
									</>
								) : (
									<>
								<div className="text-sm text-gray-700">
									<span className="font-medium">Coppia:</span> {order.coupleName}
								</div>
								<div className="text-sm text-gray-700">
									<span className="font-medium">Matrimonio:</span> {formatDate(order.weddingDate)}
								</div>

								{services.length > 0 ? (
									<>
										<div className="border-t border-gray-100 pt-3 space-y-2">
											{services.map((svc) => (
												<div key={svc.publicId} className="flex justify-between items-start text-sm gap-2">
													<span className="text-gray-700 leading-snug">
														{svc.name}
														{svc.tierLabel && (
															<span className="block text-xs text-gray-400">
																{svc.tierLabel}
																{svc.duration != null && ` · ${formatDuration(svc.duration)}`}
															</span>
														)}
													</span>
													<span className="font-medium text-gray-900 shrink-0">
														{svc.pricingType === "percentage" ? (
															<span className="text-[#7c3aed]">
																+{svc.percentageValue}%
																{svc.price != null && svc.price > 0 && ` (€${Number(svc.price).toFixed(2)})`}
															</span>
														) : svc.price != null ? (
															`€${Number(svc.price).toFixed(2)}`
														) : "—"}
													</span>
												</div>
											))}

											{cameraSurcharge > 0 && (
												<div className="flex justify-between items-center text-sm gap-2">
													<span className="text-gray-700">
														Telecamere ({order.cameraCount})
														<span className="block text-xs text-gray-400">Supplemento multi-camera</span>
													</span>
													<span className="font-medium text-orange-600 shrink-0">+€{cameraSurcharge.toFixed(2)}</span>
												</div>
											)}
											{order.quantityDiscountAmt != null && Number(order.quantityDiscountAmt) > 0 && (
												<div className="flex justify-between items-center text-sm gap-2 text-green-700">
													<span>
														Sconto quantità{order.quantityDiscountPct != null && ` (-${Number(order.quantityDiscountPct)}%)`}
													</span>
													<span className="font-medium shrink-0">-€{Number(order.quantityDiscountAmt).toFixed(2)}</span>
												</div>
											)}
										</div>

										<div className="border-t border-gray-200 pt-3 flex justify-between font-semibold text-base">
											<span className="text-gray-800">Totale</span>
											<span className="text-[#7c3aed]">
												{totalPrice != null ? `€${totalPrice.toFixed(2)}` : <em className="font-normal text-gray-400 text-sm">Da definire</em>}
											</span>
										</div>
									</>
								) : (
									<p className="text-sm text-gray-400 italic">Nessun servizio.</p>
								)}
									</>
								)}

								<div className="border-t border-gray-100 pt-3 text-xs text-gray-400 space-y-1">
									<p>Creato il {new Date(order.createdAt).toLocaleString("it-IT")}</p>
									<p>Aggiornato il {new Date(order.updatedAt).toLocaleString("it-IT")}</p>
								</div>
							</div>
						</div>
					</aside>

				</div>

				<div className="absolute bottom-4 right-4 text-gray-200/30 text-5xl font-bold select-none pointer-events-none hidden md:block">
					WeddingCut
				</div>
			</div>
		</div>
	)
}

export default OrderDetail
