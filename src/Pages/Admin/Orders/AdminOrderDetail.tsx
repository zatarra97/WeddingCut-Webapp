import { useState, useEffect, useRef } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { toast } from "react-toastify"
import {
	genericGet, genericPatch, genericDelete,
	getInvoiceUploadUrl, uploadFileToS3, getInvoiceDownloadUrl, deleteInvoice,
	updateOrderEntry, deleteOrderEntry,
} from "../../../services/api-utility"
import DeleteModal from "../../../Components/DeleteModal"
import DateTimePicker from "../../../Components/DateTimePicker"

// ─── Tipi ────────────────────────────────────────────────────────────────────

interface OrderEntry {
	publicId: string
	coupleName: string
	weddingDate: string
	status: "pending" | "in_progress" | "completed" | "cancelled"
	adminNotes?: string | null
	deliveryLink?: string | null
	// Per-entry service config
	selectedServices?: SelectedService[] | string | null
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
	totalPrice?: number | null
}

interface SelectedService {
	publicId: string
	name?: string
	pricingType?: "fixed" | "tiered" | "percentage"
	tierLabel?: string | null
	duration?: number | null
	price?: number | null
	percentageValue?: number | null
	notes?: string | null
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
	totalPrice?: number | null
	status: "pending" | "in_progress" | "completed" | "cancelled"
	adminNotes?: string
	deliveryLink?: string
	desiredDeliveryDate?: string
	invoiceUrl?: string | null
	entries?: OrderEntry[]
	createdAt: string
	updatedAt: string
}

// ─── Costanti ─────────────────────────────────────────────────────────────────

const STATUS_OPTIONS = [
	{ value: "in_progress", label: "In lavorazione" },
	{ value: "completed",   label: "Completato" },
	{ value: "cancelled",   label: "Annullato" },
]

const STATUS_CLASSES: Record<string, string> = {
	pending:     "bg-yellow-100 text-yellow-800",
	in_progress: "bg-blue-100 text-blue-800",
	completed:   "bg-green-100 text-green-800",
	cancelled:   "bg-gray-100 text-gray-600",
}

const STATUS_LABELS: Record<string, string> = {
	pending:     "In attesa di approvazione",
	in_progress: "In lavorazione",
	completed:   "Completato",
	cancelled:   "Annullato",
}

const DELIVERY_LABELS: Record<string, string> = {
	cloud_link:     "Ho già caricato il materiale",
	upload_request: "Richiedi link di caricamento",
}

const DELIVERY_ICONS: Record<string, string> = {
	cloud_link:     "fa-cloud",
	upload_request: "fa-cloud-arrow-up",
}

const CAMERA_OPTIONS = [
	{ value: "1-4", label: "1 – 4 cam", surcharge: 0 },
	{ value: "5-6", label: "5 – 6 cam", surcharge: 50 },
	{ value: "7+",  label: "7+ cam",    surcharge: 100 },
]

const EXPORT_FPS_LABELS: Record<string, string> = {
	"25": "25 fps — PAL",
	"30": "30 fps — NTSC",
}
const EXPORT_BITRATE_LABELS: Record<string, string> = {
	"20": "20 Mbps",
	"50": "50 Mbps",
}
const EXPORT_ASPECT_LABELS: Record<string, string> = {
	"16:9": "16:9 Widescreen",
	"9:16": "9:16 Verticale",
}
const EXPORT_RESOLUTION_LABELS: Record<string, string> = {
	"1920x1080": "1080p Full HD",
	"3840x2160": "4K Ultra HD",
}

const MAX_INVOICE_SIZE = 10 * 1024 * 1024 // 10 MB

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDuration(minutes: number): string {
	const mins = Math.floor(minutes)
	const secs = Math.round((minutes - mins) * 60)
	if (secs === 0) return `${mins} min`
	return `${mins}min ${secs}s`
}

function invoiceFilename(key: string): string {
	// chiave: "publicId/timestamp-filename.pdf" → "filename.pdf"
	const parts = key.split("/")
	const last = parts[parts.length - 1] ?? key
	// rimuove il prefisso timestamp-
	return last.replace(/^\d+-/, "")
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

// ─── Componente ───────────────────────────────────────────────────────────────

const AdminOrderDetail = () => {
	const navigate = useNavigate()
	const { publicId } = useParams<{ publicId: string }>()
	const [order, setOrder] = useState<Order | null>(null)
	const [loading, setLoading] = useState(true)
	const fileInputRef = useRef<HTMLInputElement>(null)

	// Form admin
	const [adminStatus,        setAdminStatus]        = useState("in_progress")
	const [adminNotes,         setAdminNotes]          = useState("")
	const [deliveryLink,       setDeliveryLink]        = useState("")
	const [desiredDeliveryDate,setDesiredDeliveryDate] = useState<string | null>(null)
	const [totalPrice,         setTotalPrice]          = useState("")
	const [invoiceKey,         setInvoiceKey]          = useState("") // chiave S3
	const [saving,             setSaving]              = useState(false)
	const [uploadingInvoice,   setUploadingInvoice]    = useState(false)

	// Entries (matrimoni batch)
	const [expandedEntry,  setExpandedEntry]  = useState<string | null>(null)
	const [entryEdits,     setEntryEdits]     = useState<Record<string, Partial<OrderEntry>>>({})
	const [savingEntry,    setSavingEntry]    = useState<string | null>(null)

	// Modali
	const [deleteOpen,      setDeleteOpen]      = useState(false)
	const [deleting,        setDeleting]        = useState(false)
	const [acceptModalOpen, setAcceptModalOpen] = useState(false)
	const [accepting,       setAccepting]       = useState(false)

	useEffect(() => {
		if (!publicId) return
		genericGet(`admin/orders/${publicId}`)
			.then((data: Order) => {
				setOrder(data)
				setAdminStatus(data.status === "pending" ? "in_progress" : data.status)
				setAdminNotes(data.adminNotes ?? "")
				setDeliveryLink(data.deliveryLink ?? "")
				setDesiredDeliveryDate(data.desiredDeliveryDate ?? null)
				setTotalPrice(data.totalPrice != null ? String(Number(data.totalPrice)) : "")
				setInvoiceKey(data.invoiceUrl ?? "")
			})
			.catch(() => {
				toast.error("Ordine non trovato")
				navigate("/admin/orders")
			})
			.finally(() => setLoading(false))
	}, [publicId])

	// ── Accetta ordine (pending → in_progress) ──────────────────────────────

	const handleAccept = async () => {
		if (!publicId) return
		setAccepting(true)
		try {
			await genericPatch(`admin/orders/${publicId}`, {
				status: "in_progress",
				adminNotes: adminNotes.trim() || null,
				deliveryLink: deliveryLink.trim() || null,
				desiredDeliveryDate: desiredDeliveryDate || null,
				totalPrice: totalPrice ? Number(totalPrice) : null,
				invoiceUrl: invoiceKey || null,
			})
			toast.success("Ordine accettato")
			setOrder((prev) => prev ? { ...prev, status: "in_progress" } : prev)
		} catch {
			toast.error("Errore durante l'accettazione")
		} finally {
			setAccepting(false)
			setAcceptModalOpen(false)
		}
	}

	const handleAcceptClick = () => {
		if (!invoiceKey) {
			setAcceptModalOpen(true)
		} else {
			handleAccept()
		}
	}

	// ── Salva modifiche (stati non-pending) ──────────────────────────────────

	const handleSave = async () => {
		if (!publicId) return
		setSaving(true)
		try {
			await genericPatch(`admin/orders/${publicId}`, {
				status: adminStatus,
				adminNotes: adminNotes.trim() || null,
				deliveryLink: deliveryLink.trim() || null,
				desiredDeliveryDate: desiredDeliveryDate || null,
				totalPrice: totalPrice ? Number(totalPrice) : null,
				invoiceUrl: invoiceKey || null,
			})
			toast.success("Modifiche salvate")
			setOrder((prev) => prev ? {
				...prev,
				status: adminStatus as Order["status"],
				adminNotes: adminNotes.trim() || undefined,
				deliveryLink: deliveryLink.trim() || undefined,
				desiredDeliveryDate: desiredDeliveryDate || undefined,
				totalPrice: totalPrice ? Number(totalPrice) : null,
				invoiceUrl: invoiceKey || null,
			} : prev)
		} catch {
			toast.error("Errore durante il salvataggio")
		} finally {
			setSaving(false)
		}
	}

	// ── Elimina ordine ────────────────────────────────────────────────────────

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

	// ── Fattura: upload ───────────────────────────────────────────────────────

	const handleInvoiceFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0]
		if (!file || !publicId) return

		if (file.size > MAX_INVOICE_SIZE) {
			toast.error("Il file non può superare 10 MB")
			return
		}

		setUploadingInvoice(true)
		try {
			const { uploadUrl, invoiceUrl: key } = await getInvoiceUploadUrl(publicId, file.name, file.type)
			await uploadFileToS3(uploadUrl, file)
			setInvoiceKey(key)
			// Salva subito la chiave nel DB
			await genericPatch(`admin/orders/${publicId}`, { invoiceUrl: key })
			toast.success("Fattura caricata")
		} catch {
			toast.error("Errore durante il caricamento della fattura")
		} finally {
			setUploadingInvoice(false)
			if (fileInputRef.current) fileInputRef.current.value = ""
		}
	}

	// ── Fattura: download ─────────────────────────────────────────────────────

	const handleDownloadInvoice = async () => {
		if (!publicId) return
		try {
			const url = await getInvoiceDownloadUrl(publicId)
			window.open(url, "_blank", "noopener,noreferrer")
		} catch {
			toast.error("Impossibile ottenere il link di download")
		}
	}

	// ── Fattura: rimozione ────────────────────────────────────────────────────

	const handleRemoveInvoice = async () => {
		if (!publicId) return
		try {
			await deleteInvoice(publicId)
			setInvoiceKey("")
			toast.success("Fattura rimossa")
		} catch {
			toast.error("Errore durante la rimozione della fattura")
		}
	}

	// ── Entry: salva ─────────────────────────────────────────────────────────

	const handleSaveEntry = async (entryPublicId: string) => {
		if (!publicId) return
		const edits = entryEdits[entryPublicId]
		if (!edits || Object.keys(edits).length === 0) { setExpandedEntry(null); return }
		setSavingEntry(entryPublicId)
		try {
			await updateOrderEntry(publicId, entryPublicId, edits)
			setOrder((prev) => {
				if (!prev) return prev
				const newEntries = (prev.entries ?? []).map((e) =>
					e.publicId === entryPublicId ? { ...e, ...edits } : e
				)
				return { ...prev, entries: newEntries }
			})
			setEntryEdits((prev) => { const n = { ...prev }; delete n[entryPublicId]; return n })
			setExpandedEntry(null)
			toast.success("Matrimonio aggiornato")
		} catch {
			toast.error("Errore durante il salvataggio")
		} finally {
			setSavingEntry(null)
		}
	}

	// ── Entry: elimina ────────────────────────────────────────────────────────

	const handleDeleteEntry = async (entryPublicId: string) => {
		if (!publicId) return
		try {
			await deleteOrderEntry(publicId, entryPublicId)
			setOrder((prev) => {
				if (!prev) return prev
				return { ...prev, entries: (prev.entries ?? []).filter((e) => e.publicId !== entryPublicId) }
			})
			toast.success("Matrimonio rimosso")
		} catch (err: any) {
			toast.error(err?.response?.data?.message ?? "Errore durante la rimozione")
		}
	}

	// ── Loading / empty ───────────────────────────────────────────────────────

	if (loading) {
		return (
			<div className="min-h-full flex items-center justify-center">
				<div className="text-center">
					<div className="animate-spin rounded-full h-10 w-10 border-b-2 border-purple-600 mx-auto mb-3" />
					<p className="text-gray-500 text-sm">Caricamento ordine…</p>
				</div>
			</div>
		)
	}

	if (!order) return null

	const isPending = order.status === "pending"

	return (
		<div className="min-h-full">
			<div className="container mx-auto p-4 md:p-6">
				{/* Breadcrumb */}
				<div className="flex items-center gap-2 mb-5 text-sm">
					<button
						onClick={() => navigate("/admin/orders")}
						className="text-violet-600 hover:text-violet-800 transition-colors cursor-pointer flex items-center gap-1.5 font-medium"
					>
						<i className="fa-solid fa-arrow-left text-xs" />
						Ordini
					</button>
					<i className="fa-solid fa-chevron-right text-xs text-gray-400" />
					<span className="text-gray-600 truncate">
						{order.entries && order.entries.length > 0 ? order.entries[0].coupleName : order.coupleName}
						{order.entries && order.entries.length > 1 && ` (+${order.entries.length - 1})`}
					</span>
				</div>

				<div className="flex flex-col lg:flex-row gap-6">

					{/* ── Colonna sinistra: dati ordine ── */}
					<div className="flex-1 space-y-6">

						{/* Info ordine */}
						<div className="rounded-xl border border-gray-200 bg-white shadow-sm p-6">
							<h2 className="text-base font-semibold text-gray-800 mb-4">Info ordine</h2>
							<InfoRow label="ID" value={order.publicId} />
							<InfoRow label="Utente" value={order.userEmail} />
							<InfoRow label="Telecamere" value={order.cameraCount} />
							<InfoRow label="Creato il" value={new Date(order.createdAt).toLocaleString("it-IT")} />
							<InfoRow label="Aggiornato il" value={new Date(order.updatedAt).toLocaleString("it-IT")} />
						</div>

						{/* Matrimoni — accordion per-entry */}
						<div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
							<div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
								<div>
									<h2 className="text-base font-semibold text-gray-800">Matrimoni</h2>
									{order.entries && order.entries.length > 1 && (
										<p className="text-xs text-gray-400 mt-0.5">{order.entries.length} matrimoni in questo ordine</p>
									)}
								</div>
							</div>

							<div className="divide-y divide-gray-100">
								{(order.entries ?? []).map((entry, entryIdx) => {
									const isExpanded = expandedEntry === entry.publicId
									const edits = entryEdits[entry.publicId] ?? {}
									const svcs: SelectedService[] = (() => {
										if (!entry.selectedServices) return []
										if (Array.isArray(entry.selectedServices)) return entry.selectedServices as SelectedService[]
										try { return JSON.parse(entry.selectedServices as string) as SelectedService[] } catch { return [] }
									})()
									const hasExport = entry.exportFps || entry.exportBitrate || entry.exportAspect || entry.exportResolution
									const entryStatus = (edits.status ?? entry.status) as string
									return (
										<div key={entry.publicId}>
											{/* Header accordion */}
											<button
												type="button"
												onClick={() => setExpandedEntry(isExpanded ? null : entry.publicId)}
												className="w-full flex items-center gap-4 px-6 py-4 text-left hover:bg-gray-50 transition-colors cursor-pointer"
											>
												{/* Numero */}
												<div className="w-7 h-7 rounded-full bg-violet-100 text-violet-700 text-xs font-bold flex items-center justify-center shrink-0">
													{entryIdx + 1}
												</div>
												{/* Info coppia */}
												<div className="flex-1 min-w-0">
													<p className="font-semibold text-gray-900 text-sm truncate">{entry.coupleName}</p>
													<p className="text-xs text-gray-400 mt-0.5">
														<i className="fa-solid fa-ring text-[9px] mr-1 text-violet-300" />
														{new Date(entry.weddingDate).toLocaleDateString("it-IT", { day: "numeric", month: "long", year: "numeric" })}
													</p>
												</div>
												{/* Status badge */}
												<span className={`hidden sm:inline-flex items-center text-xs font-semibold px-2.5 py-1 rounded-full shrink-0 ${STATUS_CLASSES[entry.status] ?? "bg-gray-100 text-gray-600"}`}>
													{STATUS_LABELS[entry.status] ?? entry.status}
												</span>
												{/* Prezzo */}
												{entry.totalPrice != null && (
													<span className="text-sm font-bold text-violet-700 shrink-0">€{Number(entry.totalPrice).toFixed(2)}</span>
												)}
												<i className={`fa-solid fa-chevron-${isExpanded ? "up" : "down"} text-gray-400 text-xs shrink-0`} />
											</button>

											{/* Body accordion */}
											{isExpanded && (
												<div className="border-t border-gray-100">

													{/* ── Sezione cliente ── */}
													<div className="px-6 py-5 space-y-6 bg-gray-50/60">

														{/* Servizi */}
														{svcs.length > 0 && (
															<div>
																<p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Servizi</p>
																<div className="space-y-2">
																	{svcs.map((svc) => (
																		<div key={svc.publicId} className="rounded-lg border border-gray-200 bg-white p-3">
																			<div className="flex items-start justify-between gap-3">
																				<div className="flex-1 min-w-0">
																					<p className="font-semibold text-gray-900 text-sm">{svc.name}</p>
																					{svc.tierLabel && (
																						<div className="flex items-center gap-2 mt-1.5">
																							<span className="inline-flex items-center px-2 py-0.5 rounded-md bg-violet-600 text-white text-xs font-semibold">{svc.tierLabel}</span>
																							{svc.duration != null && (
																								<span className="text-xs text-gray-400">
																									<i className="fa-regular fa-clock mr-1" />{formatDuration(svc.duration)}
																								</span>
																							)}
																						</div>
																					)}
																					{svc.notes && (
																						<p className="text-xs text-gray-500 mt-1.5 bg-gray-50 rounded px-2 py-1 border border-gray-100">{svc.notes}</p>
																					)}
																				</div>
																				<div className="shrink-0 text-right">
																					{svc.pricingType === "percentage" ? (
																						<span className="text-sm font-semibold text-amber-600">
																							+{svc.percentageValue}%
																							{svc.price != null && svc.price > 0 && <span className="block text-xs font-normal text-gray-500">€{Number(svc.price).toFixed(2)}</span>}
																						</span>
																					) : svc.price != null ? (
																						<span className="text-sm font-semibold text-gray-900">€{Number(svc.price).toFixed(2)}</span>
																					) : null}
																				</div>
																			</div>
																		</div>
																	))}
																</div>
																{/* Totali entry */}
																<div className="mt-3 space-y-1 rounded-lg border border-gray-200 bg-white p-3">
																	{entry.servicesTotal != null && (
																		<div className="flex justify-between text-xs text-gray-500">
																			<span>Subtotale servizi</span>
																			<span>€{Number(entry.servicesTotal).toFixed(2)}</span>
																		</div>
																	)}
																	{entry.cameraSurcharge != null && Number(entry.cameraSurcharge) > 0 && (
																		<div className="flex justify-between text-xs text-orange-600">
																			<span>Supplemento multi-camera</span>
																			<span>+€{Number(entry.cameraSurcharge).toFixed(2)}</span>
																		</div>
																	)}
																	{entry.totalPrice != null && (
																		<div className="flex justify-between text-sm font-bold border-t border-gray-100 pt-1.5 mt-1">
																			<span className="text-gray-800">Totale matrimonio</span>
																			<span className="text-violet-700">€{Number(entry.totalPrice).toFixed(2)}</span>
																		</div>
																	)}
																</div>
															</div>
														)}

														{/* Materiale + Telecamere */}
														<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
															{entry.deliveryMethod && (
																<div>
																	<p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Materiale</p>
																	<div className="rounded-lg border border-gray-200 bg-white p-3 space-y-1.5">
																		<div className="flex items-center gap-2 text-sm text-gray-700">
																			<i className={`fa-solid ${DELIVERY_ICONS[entry.deliveryMethod] ?? "fa-cloud"} text-violet-400`} />
																			<span className="font-medium">{DELIVERY_LABELS[entry.deliveryMethod] ?? entry.deliveryMethod}</span>
																		</div>
																		{entry.deliveryMethod === "cloud_link" && entry.materialLink && (
																			<a href={entry.materialLink} target="_blank" rel="noopener noreferrer" className="block text-xs text-violet-600 underline truncate">{entry.materialLink}</a>
																		)}
																		{entry.materialSizeGb != null && (
																			<p className="text-xs text-gray-500"><i className="fa-solid fa-hard-drive mr-1" />{entry.materialSizeGb} GB</p>
																		)}
																	</div>
																</div>
															)}
															{entry.cameraCount && (
																<div>
																	<p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Telecamere</p>
																	<div className="flex gap-2">
																		{CAMERA_OPTIONS.map((opt) => {
																			const active = entry.cameraCount === opt.value
																			return (
																				<div key={opt.value} className={`flex-1 flex flex-col items-center gap-1 py-2 rounded-lg border-2 text-center ${active ? "border-violet-500 bg-violet-50" : "border-gray-200 opacity-40"}`}>
																					<i className={`fa-solid fa-video text-lg ${active ? "text-violet-600" : "text-gray-400"}`} />
																					<span className={`text-xs font-bold ${active ? "text-violet-700" : "text-gray-600"}`}>{opt.label}</span>
																					{opt.surcharge > 0
																						? <span className={`text-[10px] ${active ? "text-violet-500" : "text-orange-400"}`}>+€{opt.surcharge}</span>
																						: <span className="text-[10px] text-gray-400">Incluso</span>
																					}
																				</div>
																			)
																		})}
																	</div>
																</div>
															)}
														</div>

														{/* Export */}
														{hasExport && (
															<div>
																<p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Esportazione</p>
																<div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
																	{entry.exportFps && (
																		<div className="rounded-lg border border-gray-200 bg-white px-3 py-2">
																			<p className="text-[10px] text-gray-400 uppercase tracking-wide">FPS</p>
																			<p className="text-sm font-semibold text-gray-800 mt-0.5">{EXPORT_FPS_LABELS[entry.exportFps] ?? entry.exportFps}</p>
																		</div>
																	)}
																	{entry.exportBitrate && (
																		<div className="rounded-lg border border-gray-200 bg-white px-3 py-2">
																			<p className="text-[10px] text-gray-400 uppercase tracking-wide">Bitrate</p>
																			<p className="text-sm font-semibold text-gray-800 mt-0.5">{EXPORT_BITRATE_LABELS[entry.exportBitrate] ?? entry.exportBitrate}</p>
																		</div>
																	)}
																	{entry.exportAspect && (
																		<div className="rounded-lg border border-gray-200 bg-white px-3 py-2">
																			<p className="text-[10px] text-gray-400 uppercase tracking-wide">Formato</p>
																			<p className="text-sm font-semibold text-gray-800 mt-0.5">{EXPORT_ASPECT_LABELS[entry.exportAspect] ?? entry.exportAspect}</p>
																		</div>
																	)}
																	{entry.exportResolution && (
																		<div className="rounded-lg border border-gray-200 bg-white px-3 py-2">
																			<p className="text-[10px] text-gray-400 uppercase tracking-wide">Risoluzione</p>
																			<p className="text-sm font-semibold text-gray-800 mt-0.5">{EXPORT_RESOLUTION_LABELS[entry.exportResolution] ?? entry.exportResolution}</p>
																		</div>
																	)}
																</div>
															</div>
														)}
													</div>

													{/* ── Sezione admin ── */}
													<div className="border-t border-violet-100 bg-violet-50/40 px-6 py-3">
														<p className="text-xs font-semibold text-violet-500 uppercase tracking-wide">Azioni amministratore</p>
													</div>
													<div className="px-6 py-5 space-y-4">
														{/* Stato entry */}
														<div>
															<label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Stato</label>
															<select
																value={entryStatus}
																onChange={(e) => setEntryEdits((prev) => ({ ...prev, [entry.publicId]: { ...(prev[entry.publicId] ?? {}), status: e.target.value as OrderEntry["status"] } }))}
																className={`block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-violet-500 focus:ring-1 focus:ring-violet-500 ${STATUS_CLASSES[entryStatus] ?? ""}`}
															>
																{["pending", "in_progress", "completed", "cancelled"].map((s) => (
																	<option key={s} value={s}>{STATUS_LABELS[s] ?? s}</option>
																))}
															</select>
														</div>
														{/* Note admin */}
														<div>
															<label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Note per il cliente</label>
															<textarea
																rows={3}
																value={edits.adminNotes ?? entry.adminNotes ?? ""}
																onChange={(e) => setEntryEdits((prev) => ({ ...prev, [entry.publicId]: { ...(prev[entry.publicId] ?? {}), adminNotes: e.target.value } }))}
																placeholder="Note visibili al cliente per questo matrimonio…"
																className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-violet-500 focus:ring-1 focus:ring-violet-500 resize-none"
															/>
														</div>
														{/* Delivery link */}
														<div>
															<label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Link di consegna</label>
															<input
																type="url"
																value={edits.deliveryLink ?? entry.deliveryLink ?? ""}
																onChange={(e) => setEntryEdits((prev) => ({ ...prev, [entry.publicId]: { ...(prev[entry.publicId] ?? {}), deliveryLink: e.target.value } }))}
																placeholder="https://…"
																className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-violet-500 focus:ring-1 focus:ring-violet-500"
															/>
														</div>
														{/* Azioni */}
														<div className="flex items-center gap-2">
															<button
																type="button"
																onClick={() => handleSaveEntry(entry.publicId)}
																disabled={savingEntry === entry.publicId}
																className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-lg bg-violet-600 text-white text-sm font-medium hover:bg-violet-700 disabled:opacity-50 transition-colors cursor-pointer"
															>
																{savingEntry === entry.publicId
																	? <><i className="fa-solid fa-spinner fa-spin" /> Salvataggio…</>
																	: <><i className="fa-solid fa-floppy-disk" /> Salva modifiche</>
																}
															</button>
															{(order.entries ?? []).length > 1 && (
																<button
																	type="button"
																	onClick={() => handleDeleteEntry(entry.publicId)}
																	className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg border border-red-200 text-red-600 text-sm font-medium hover:bg-red-50 transition-colors cursor-pointer"
																>
																	<i className="fa-solid fa-trash text-xs" />
																</button>
															)}
														</div>
													</div>
												</div>
											)}
										</div>
									)
								})}
							</div>
						</div>

						{/* Note comuni */}
						{(order.generalNotes || order.referenceVideo) && (
							<div className="rounded-xl border border-gray-200 bg-white shadow-sm p-6">
								<h2 className="text-base font-semibold text-gray-800 mb-4">Note comuni</h2>
								{order.generalNotes && <InfoRow label="Note generali" value={order.generalNotes} />}
								{order.referenceVideo && <InfoRow label="Video di riferimento" value={order.referenceVideo} />}
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
									{isPending ? (
										<span className={`inline-flex items-center text-xs font-semibold px-2.5 py-1.5 rounded-lg w-full justify-center ${STATUS_CLASSES.pending}`}>
											{STATUS_LABELS.pending}
										</span>
									) : (
										<select
											value={adminStatus}
											onChange={(e) => setAdminStatus(e.target.value)}
											className={`block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-violet-500 focus:ring-1 focus:ring-violet-500 ${STATUS_CLASSES[adminStatus] ?? ""}`}
										>
											{STATUS_OPTIONS.map((o) => (
												<option key={o.value} value={o.value}>{o.label}</option>
											))}
										</select>
									)}
								</div>

								{/* Totale ordine */}
								<div>
									<label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
										Totale ordine (€)
									</label>
									<input
										type="number"
										min="0"
										step="0.01"
										value={totalPrice}
										onChange={(e) => setTotalPrice(e.target.value)}
										placeholder="Es. 850.00"
										className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-violet-500 focus:ring-1 focus:ring-violet-500"
									/>
									{order.totalPrice != null && (
										<p className="text-xs text-gray-400 mt-1">
											Prezzo calcolato: €{Number(order.totalPrice).toFixed(2)}
										</p>
									)}
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
										className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-violet-500 focus:ring-1 focus:ring-violet-500 resize-none"
									/>
								</div>

								{/* Data di consegna */}
								<div>
									<DateTimePicker
										label="Data di consegna"
										value={desiredDeliveryDate}
										onChange={(date) => setDesiredDeliveryDate(date)}
									/>
									{order.desiredDeliveryDate && desiredDeliveryDate !== order.desiredDeliveryDate && (
										<p className="text-xs text-amber-600 mt-1">
											<i className="fa-solid fa-triangle-exclamation mr-1" />
											Modificata rispetto alla richiesta ({new Date(order.desiredDeliveryDate).toLocaleDateString("it-IT")})
										</p>
									)}
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
										className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-violet-500 focus:ring-1 focus:ring-violet-500"
									/>
								</div>

								{/* Fattura */}
								<div>
									<label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
										Fattura
									</label>
									{invoiceKey ? (
										<div className="rounded-lg border border-green-200 bg-green-50 p-3 space-y-2">
											<div className="flex items-center gap-2 text-sm text-green-800">
												<i className="fa-solid fa-file-invoice text-green-600" aria-hidden />
												<span className="font-medium truncate flex-1">{invoiceFilename(invoiceKey)}</span>
											</div>
											<div className="flex gap-2">
												<button
													type="button"
													onClick={handleDownloadInvoice}
													className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md bg-green-600 text-white text-xs font-medium hover:bg-green-700 transition-colors cursor-pointer"
												>
													<i className="fa-solid fa-download text-[10px]" />
													Scarica
												</button>
												<button
													type="button"
													onClick={handleRemoveInvoice}
													className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md border border-red-200 text-red-600 text-xs font-medium hover:bg-red-50 transition-colors cursor-pointer"
												>
													<i className="fa-solid fa-trash text-[10px]" />
													Rimuovi
												</button>
											</div>
										</div>
									) : (
										<div>
											<input
												ref={fileInputRef}
												type="file"
												accept=".pdf,image/jpeg,image/png,image/webp"
												onChange={handleInvoiceFileChange}
												disabled={uploadingInvoice}
												className="block w-full text-xs text-gray-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-medium file:bg-violet-50 file:text-violet-700 hover:file:bg-violet-100 file:cursor-pointer cursor-pointer disabled:opacity-50"
											/>
											<p className="text-xs text-gray-400 mt-1">PDF o immagine, max 10 MB</p>
											{uploadingInvoice && (
												<p className="text-xs text-violet-600 mt-1 flex items-center gap-1.5">
													<i className="fa-solid fa-spinner fa-spin" />
													Caricamento in corso…
												</p>
											)}
										</div>
									)}
								</div>

								{/* Pulsante principale */}
								{isPending ? (
									<button
										type="button"
										onClick={handleAcceptClick}
										disabled={accepting || uploadingInvoice}
										className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-green-600 text-white text-sm font-medium hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer"
									>
										{accepting
											? <><i className="fa-solid fa-spinner fa-spin" /> Accettazione…</>
											: <><i className="fa-solid fa-circle-check" /> Accetta ordine</>
										}
									</button>
								) : (
									<button
										type="button"
										onClick={handleSave}
										disabled={saving || uploadingInvoice}
										className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-purple-700 text-white text-sm font-medium hover:bg-purple-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer"
									>
										{saving
											? <><i className="fa-solid fa-spinner fa-spin" /> Salvataggio…</>
											: <><i className="fa-solid fa-floppy-disk" /> Salva modifiche</>
										}
									</button>
								)}

								{/* Elimina */}
								<button
									type="button"
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

			{/* Modale elimina ordine */}
			<DeleteModal
				isOpen={deleteOpen}
				onClose={() => setDeleteOpen(false)}
				onConfirm={handleDelete}
				title="Elimina ordine"
				description={`Sei sicuro di voler eliminare l'ordine di ${order.coupleName}? L'operazione è irreversibile.`}
				isLoading={deleting}
			/>

			{/* Modale accetta senza fattura */}
			{acceptModalOpen && (
				<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
					<div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
						<div className="flex items-start gap-4">
							<div className="flex-shrink-0 flex items-center justify-center w-10 h-10 rounded-full bg-amber-100">
								<i className="fa-solid fa-triangle-exclamation text-amber-600" />
							</div>
							<div className="flex-1">
								<h3 className="text-base font-semibold text-gray-900 mb-1">Accetta senza fattura</h3>
								<p className="text-sm text-gray-600">
									Sei sicuro di voler accettare l'ordine senza inviare una fattura al cliente?
								</p>
							</div>
						</div>
						<div className="flex justify-end gap-3 mt-6">
							<button
								type="button"
								onClick={() => setAcceptModalOpen(false)}
								disabled={accepting}
								className="px-4 py-2 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors cursor-pointer"
							>
								Annulla
							</button>
							<button
								type="button"
								onClick={handleAccept}
								disabled={accepting}
								className="px-4 py-2 rounded-lg bg-green-600 text-white text-sm font-medium hover:bg-green-700 disabled:opacity-50 transition-colors cursor-pointer"
							>
								{accepting
									? <><i className="fa-solid fa-spinner fa-spin mr-1" />Accettazione…</>
									: "Accetta comunque"
								}
							</button>
						</div>
					</div>
				</div>
			)}
		</div>
	)
}

export default AdminOrderDetail
