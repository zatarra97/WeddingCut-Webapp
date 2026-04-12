import { useState, useEffect } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { toast } from "react-toastify"
import { genericGet } from "../../services/api-utility"

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
}

interface Order {
	publicId: string
	coupleName: string
	weddingDate: string
	desiredDeliveryDate?: string | null
	entries?: OrderEntry[]
	deliveryMethod: "cloud_link" | "upload_request"
	materialLink?: string | null
	materialSizeGb: number
	cameraCount: "1-4" | "5-6" | "7+"
	generalNotes?: string | null
	referenceVideo?: string | null
	exportFps?: string | null
	exportBitrate?: string | null
	exportAspect?: string | null
	exportResolution?: string | null
	selectedServices: StoredService[] | string
	servicesTotal?: number | null
	cameraSurcharge?: number | null
	totalPrice?: number | null
	status: "pending" | "in_progress" | "completed" | "cancelled"
	adminNotes?: string | null
	deliveryLink?: string | null
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
	pending:     "In attesa di approvazione",
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

function parseServices(raw: StoredService[] | string): StoredService[] {
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
					<h1 className="text-xl font-bold text-gray-800">{order.coupleName}</h1>
				</div>

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

						{/* Matrimoni inclusi (solo batch) */}
						{order.entries && order.entries.length > 1 && (
							<div className="rounded-xl border border-gray-200 bg-white shadow-sm p-6 md:p-8 space-y-4">
								<div>
									<h2 className="text-lg font-semibold text-gray-900">Matrimoni inclusi</h2>
									<p className="text-sm text-gray-500 mt-0.5">{order.entries.length} matrimoni in questo ordine.</p>
								</div>
								<div className="divide-y divide-gray-100">
									{order.entries.map((entry) => (
										<div key={entry.publicId} className="flex flex-col sm:flex-row sm:items-center gap-2 py-3 first:pt-0 last:pb-0">
											<div className="flex-1 min-w-0">
												<p className="font-semibold text-gray-900 text-sm">{entry.coupleName}</p>
												<p className="text-xs text-gray-500 mt-0.5">
													<i className="fa-solid fa-ring text-[9px] mr-1 text-[#a78bfa]" aria-hidden />
													{formatDate(entry.weddingDate)}
												</p>
											</div>
												</div>
									))}
								</div>
							</div>
						)}

						{/* Servizi */}
						<div className="rounded-xl border border-gray-200 bg-white shadow-sm p-6 md:p-8 space-y-4">
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
						</div>

						{/* Materiale */}
						<div className="rounded-xl border border-gray-200 bg-white shadow-sm p-6 md:p-8 space-y-4">
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
							<div>
								<p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Dimensione totale materiale</p>
								<p className="text-sm font-medium text-gray-800">{order.materialSizeGb} GB</p>
							</div>
						</div>

						{/* Note */}
						{(order.generalNotes || order.referenceVideo) && (
							<div className="rounded-xl border border-gray-200 bg-white shadow-sm p-6 md:p-8 space-y-4">
								<h2 className="text-lg font-semibold text-gray-900">Note</h2>
								{order.generalNotes && (
									<div>
										<p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Note generali</p>
										<p className="text-sm text-gray-700 whitespace-pre-wrap bg-gray-50 rounded-lg border border-gray-100 p-3">{order.generalNotes}</p>
									</div>
								)}
								{order.referenceVideo && (
									<div>
										<p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Video di riferimento</p>
										<p className="text-sm text-gray-700 whitespace-pre-wrap bg-gray-50 rounded-lg border border-gray-100 p-3">{order.referenceVideo}</p>
									</div>
								)}
							</div>
						)}

						{/* Telecamere */}
						<div className="rounded-xl border border-gray-200 bg-white shadow-sm p-6 md:p-8 space-y-4">
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
						</div>

						{/* Impostazioni esportazione */}
						{(order.exportFps || order.exportBitrate || order.exportAspect || order.exportResolution) && (
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
								<div className="text-sm text-gray-700">
									<span className="font-medium">Coppia:</span> {order.coupleName}
								</div>
								<div className="text-sm text-gray-700">
									<span className="font-medium">Matrimonio:</span> {formatDate(order.weddingDate)}
								</div>
								{order.desiredDeliveryDate && (
									<div className="text-sm text-gray-700">
										<span className="font-medium">Consegna desiderata:</span> {formatDate(order.desiredDeliveryDate)}
									</div>
								)}

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
