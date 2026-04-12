import { useState, useEffect, useRef } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { toast } from "react-toastify"
import {
	genericGet, genericPatch, genericDelete,
	getInvoiceUploadUrl, uploadFileToS3, getInvoiceDownloadUrl, deleteInvoice,
	updateOrderEntry, addOrderEntry, deleteOrderEntry,
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
	servicesTotal?: number | null
	cameraSurcharge?: number | null
	totalPrice?: number | null
	cameraCount?: "1-4" | "5-6" | "7+" | null
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

const PRICING_TYPE_LABELS: Record<string, string> = {
	fixed:      "Prezzo fisso",
	tiered:     "A fasce",
	percentage: "Percentuale",
}

const PRICING_TYPE_CLASSES: Record<string, string> = {
	fixed:      "bg-blue-50 text-blue-700",
	tiered:     "bg-violet-50 text-violet-700",
	percentage: "bg-amber-50 text-amber-700",
}

const DELIVERY_LABELS: Record<string, string> = {
	cloud_link:     "Link cloud",
	upload_request: "Link di caricamento richiesto",
}

const MAX_INVOICE_SIZE = 10 * 1024 * 1024 // 10 MB

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDuration(minutes: number): string {
	const mins = Math.floor(minutes)
	const secs = Math.round((minutes - mins) * 60)
	if (secs === 0) return `${mins} min`
	return `${mins}min ${secs}s`
}

function parseServices(raw: SelectedService[] | string): SelectedService[] {
	if (Array.isArray(raw)) return raw
	if (typeof raw === "string") {
		try { return JSON.parse(raw) } catch { return [] }
	}
	return []
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
	const [addingEntry,    setAddingEntry]    = useState(false)
	const [newEntryName,   setNewEntryName]   = useState("")
	const [newEntryDate,   setNewEntryDate]   = useState("")

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

	// ── Entry: aggiungi ───────────────────────────────────────────────────────

	const handleAddEntry = async () => {
		if (!publicId) return
		if (!newEntryName.trim()) { toast.error("Inserisci il nome della coppia"); return }
		if (!newEntryDate) { toast.error("Inserisci la data del matrimonio"); return }
		try {
			const newEntry = await addOrderEntry(publicId, { coupleName: newEntryName.trim(), weddingDate: newEntryDate })
			setOrder((prev) => prev ? { ...prev, entries: [...(prev.entries ?? []), newEntry] } : prev)
			setNewEntryName("")
			setNewEntryDate("")
			setAddingEntry(false)
			toast.success("Matrimonio aggiunto")
		} catch {
			toast.error("Errore durante l'aggiunta")
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

						{/* Matrimoni */}
						<div className="rounded-xl border border-gray-200 bg-white shadow-sm p-6">
							<div className="flex items-center justify-between mb-4">
								<h2 className="text-base font-semibold text-gray-800">
									Matrimoni
									{order.entries && order.entries.length > 1 && (
										<span className="ml-2 text-xs font-normal text-gray-400">({order.entries.length})</span>
									)}
								</h2>
							</div>

							<div className="space-y-2">
								{(order.entries ?? []).map((entry) => {
									const isExpanded = expandedEntry === entry.publicId
									const edits = entryEdits[entry.publicId] ?? {}
									return (
										<div key={entry.publicId} className="rounded-lg border border-gray-200 overflow-hidden">
											{/* Header riga */}
											<button
												type="button"
												onClick={() => setExpandedEntry(isExpanded ? null : entry.publicId)}
												className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left hover:bg-gray-50 transition-colors cursor-pointer"
											>
												<div className="flex items-center gap-3 min-w-0 flex-1">
													<div className="min-w-0">
														<p className="font-semibold text-gray-900 text-sm truncate">{entry.coupleName}</p>
														<p className="text-xs text-gray-500">{new Date(entry.weddingDate).toLocaleDateString("it-IT")}</p>
													</div>
																			</div>
												<i className={`fa-solid fa-chevron-${isExpanded ? "up" : "down"} text-gray-400 text-xs shrink-0`} />
											</button>

											{/* Body espandibile */}
											{isExpanded && (
												<div className="border-t border-gray-100 p-4 space-y-3 bg-gray-50/50">
													{/* Servizi entry (read-only) */}
													{(() => {
														const svcs: SelectedService[] = (() => {
															if (!entry.selectedServices) return []
															if (Array.isArray(entry.selectedServices)) return entry.selectedServices as SelectedService[]
															try { return JSON.parse(entry.selectedServices as string) as SelectedService[] } catch { return [] }
														})()
														if (svcs.length === 0) return null
														return (
															<div>
																<p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Servizi</p>
																<div className="space-y-1">
																	{svcs.map((svc) => (
																		<div key={svc.publicId} className="flex justify-between items-start text-xs gap-2">
																			<span className="text-gray-600">
																				{svc.name}
																				{svc.tierLabel && <span className="text-gray-400 ml-1">({svc.tierLabel})</span>}
																			</span>
																			<span className="font-medium text-gray-800 shrink-0">
																				{svc.pricingType === "percentage"
																					? <span className="text-violet-600">+{svc.percentageValue}%{svc.price != null && svc.price > 0 ? ` (€${Number(svc.price).toFixed(2)})` : ""}</span>
																					: svc.price != null ? `€${Number(svc.price).toFixed(2)}` : "—"}
																			</span>
																		</div>
																	))}
																	{entry.cameraSurcharge != null && Number(entry.cameraSurcharge) > 0 && (
																		<div className="flex justify-between text-xs gap-2">
																			<span className="text-gray-500">Supplemento multi-camera ({entry.cameraCount})</span>
																			<span className="font-medium text-orange-600 shrink-0">+€{Number(entry.cameraSurcharge).toFixed(2)}</span>
																		</div>
																	)}
																	{entry.totalPrice != null && (
																		<div className="flex justify-between text-xs font-semibold border-t border-gray-200 mt-1 pt-1">
																			<span className="text-gray-700">Totale matrimonio</span>
																			<span className="text-violet-600">€{Number(entry.totalPrice).toFixed(2)}</span>
																		</div>
																	)}
																</div>
															</div>
														)
													})()}
													{/* Note admin */}
													<div>
														<label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Note per il cliente</label>
														<textarea
															rows={2}
															value={edits.adminNotes ?? entry.adminNotes ?? ""}
															onChange={(e) => setEntryEdits((prev) => ({ ...prev, [entry.publicId]: { ...(prev[entry.publicId] ?? {}), adminNotes: e.target.value } }))}
															placeholder="Note visibili al cliente per questo matrimonio…"
															className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-violet-500 focus:ring-1 focus:ring-violet-500 resize-none"
														/>
													</div>
													{/* Delivery link */}
													<div>
														<label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Link di consegna</label>
														<input
															type="url"
															value={edits.deliveryLink ?? entry.deliveryLink ?? ""}
															onChange={(e) => setEntryEdits((prev) => ({ ...prev, [entry.publicId]: { ...(prev[entry.publicId] ?? {}), deliveryLink: e.target.value } }))}
															placeholder="https://…"
															className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-violet-500 focus:ring-1 focus:ring-violet-500"
														/>
													</div>
													{/* Azioni */}
													<div className="flex items-center gap-2 pt-1">
														<button
															type="button"
															onClick={() => handleSaveEntry(entry.publicId)}
															disabled={savingEntry === entry.publicId}
															className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-violet-600 text-white text-xs font-medium hover:bg-violet-700 disabled:opacity-50 transition-colors cursor-pointer"
														>
															{savingEntry === entry.publicId
																? <><i className="fa-solid fa-spinner fa-spin" /> Salvataggio…</>
																: <><i className="fa-solid fa-floppy-disk" /> Salva</>
															}
														</button>
														{(order.entries ?? []).length > 1 && (
															<button
																type="button"
																onClick={() => handleDeleteEntry(entry.publicId)}
																className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-red-200 text-red-600 text-xs font-medium hover:bg-red-50 transition-colors cursor-pointer"
																title="Rimuovi matrimonio"
															>
																<i className="fa-solid fa-trash text-[10px]" />
															</button>
														)}
													</div>
												</div>
											)}
										</div>
									)
								})}
							</div>

							{/* Aggiungi matrimonio */}
							{addingEntry ? (
								<div className="mt-3 rounded-lg border border-violet-200 bg-violet-50 p-3 space-y-2">
									<p className="text-xs font-semibold text-violet-700 uppercase tracking-wide">Nuovo matrimonio</p>
									<input
										type="text"
										value={newEntryName}
										onChange={(e) => setNewEntryName(e.target.value)}
										placeholder="Nome della coppia…"
										className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-violet-500 focus:ring-1 focus:ring-violet-500"
									/>
									<input
										type="date"
										value={newEntryDate}
										onChange={(e) => setNewEntryDate(e.target.value)}
										className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-violet-500 focus:ring-1 focus:ring-violet-500"
									/>
									<div className="flex gap-2">
										<button
											type="button"
											onClick={handleAddEntry}
											className="flex-1 px-3 py-1.5 rounded-lg bg-violet-600 text-white text-xs font-medium hover:bg-violet-700 transition-colors cursor-pointer"
										>
											Aggiungi
										</button>
										<button
											type="button"
											onClick={() => { setAddingEntry(false); setNewEntryName(""); setNewEntryDate("") }}
											className="px-3 py-1.5 rounded-lg border border-gray-300 text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors cursor-pointer"
										>
											Annulla
										</button>
									</div>
								</div>
							) : (
								<button
									type="button"
									onClick={() => setAddingEntry(true)}
									className="mt-3 w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-dashed border-violet-300 text-violet-600 text-xs font-medium hover:bg-violet-50 transition-colors cursor-pointer"
								>
									<i className="fa-solid fa-plus text-[10px]" />
									Aggiungi matrimonio
								</button>
							)}
						</div>

						{/* Servizi */}
						<div className="rounded-xl border border-gray-200 bg-white shadow-sm p-6">
							<h2 className="text-base font-semibold text-gray-800 mb-4">Servizi selezionati</h2>
							{(() => {
								const services = parseServices(order.selectedServices as any)
								if (services.length === 0) return <p className="text-sm text-gray-400 italic">Nessun servizio</p>
								return (
									<div className="space-y-3">
										{services.map((s, i) => (
											<div key={i} className="rounded-lg border border-gray-200 bg-gray-50/50 p-4 space-y-3">
												<div className="flex items-start justify-between gap-3">
													<p className="font-semibold text-gray-900 text-sm leading-snug">
														{s.name ?? <span className="font-mono text-xs text-gray-400">{s.publicId}</span>}
													</p>
													{s.pricingType && (
														<span className={`shrink-0 inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-full ${PRICING_TYPE_CLASSES[s.pricingType] ?? "bg-gray-100 text-gray-600"}`}>
															{PRICING_TYPE_LABELS[s.pricingType] ?? s.pricingType}
														</span>
													)}
												</div>
												{s.tierLabel && (
													<div className="flex flex-wrap items-center gap-2">
														<span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Fascia:</span>
														<span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-violet-600 text-white text-xs font-semibold">
															{s.tierLabel}
														</span>
													</div>
												)}
												{s.duration != null && (
													<div className="flex items-center gap-1.5 text-sm text-gray-600">
														<i className="fa-regular fa-clock text-gray-400 text-xs" aria-hidden />
														<span>Durata stimata: <strong>{formatDuration(s.duration)}</strong></span>
													</div>
												)}
												{s.pricingType === "percentage" ? (
													<div className="flex items-center gap-1.5 text-sm">
														<i className="fa-solid fa-percent text-amber-500 text-xs" aria-hidden />
														<span className="text-gray-700">
															+<strong>{s.percentageValue}%</strong>
															{s.price != null && s.price > 0 && (
																<span className="text-gray-500 ml-1">= €{Number(s.price).toFixed(2)}</span>
															)}
														</span>
													</div>
												) : s.price != null ? (
													<div className="flex items-center gap-1.5 text-sm text-gray-700">
														<i className="fa-solid fa-euro-sign text-gray-400 text-xs" aria-hidden />
														<span>Prezzo: <strong>€{Number(s.price).toFixed(2)}</strong></span>
													</div>
												) : null}
												{s.notes && (
													<div className="rounded-md border border-gray-200 bg-white px-3 py-2">
														<p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-0.5">Note cliente</p>
														<p className="text-sm text-gray-700 whitespace-pre-wrap">{s.notes}</p>
													</div>
												)}
											</div>
										))}
										<div className="pt-1 space-y-1.5 border-t border-gray-100 mt-1">
											{order.servicesTotal != null && (
												<div className="flex justify-between items-center text-sm">
													<span className="text-gray-500">Subtotale servizi</span>
													<span className="text-gray-700 font-medium">€{Number(order.servicesTotal).toFixed(2)}</span>
												</div>
											)}
											{Number(order.cameraSurcharge) > 0 && (
												<div className="flex justify-between items-center text-sm">
													<span className="text-gray-500">Supplemento multi-camera ({order.cameraCount})</span>
													<span className="text-orange-600 font-medium">+€{Number(order.cameraSurcharge).toFixed(2)}</span>
												</div>
											)}
											{order.totalPrice != null && (
												<div className="flex justify-between items-center text-sm font-bold border-t border-gray-200 pt-2 mt-1">
													<span className="text-gray-800">Totale</span>
													<span className="text-violet-700">€{Number(order.totalPrice).toFixed(2)}</span>
												</div>
											)}
										</div>
									</div>
								)
							})()}
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
