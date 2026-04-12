import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { toast } from "react-toastify"
import Input from "../../Components/Input"
import Textarea from "../../Components/Textarea"
import Select from "../../Components/Select"
import DateTimePicker from "../../Components/DateTimePicker"
import { genericGet, genericPost } from "../../services/api-utility"

// ─── Tipi ────────────────────────────────────────────────────────────────────

interface PriceTier {
	label: string
	price: number
}

interface PublicService {
	publicId: string
	name: string
	description: string
	durationDescription?: string | null
	category: "main" | "extra" | "delivery"
	pricingType: "fixed" | "tiered" | "percentage"
	basePrice?: number | null
	percentageValue?: number | null
	priceTiers?: PriceTier[] | null
	restrictedToService?: string | null
	sortOrder?: number | null
}

interface SelectedService {
	publicId: string
	tierLabel?: string | null   // solo per pricingType === 'tiered'
	duration?: number | null    // minuti (0.5 = 30s) — presente se la fascia ha un range
	notes?: string
}

type DeliveryMethod = "cloud_link" | "upload_request"
type CameraCount = "1-4" | "5-6" | "7+"

// ─── Costanti ─────────────────────────────────────────────────────────────────

const CAMERA_OPTIONS: { value: CameraCount; label: string; surcharge: number }[] = [
	{ value: "1-4", label: "1 – 4", surcharge: 0   },
	{ value: "5-6", label: "5 – 6", surcharge: 50  },
	{ value: "7+",  label: "7 +",   surcharge: 100 },
]

const EXPORT_FPS_OPTIONS = [
	{ value: "25", label: "25 fps — PAL / Standard europeo" },
	{ value: "30", label: "30 fps — NTSC / Web" },
]

const EXPORT_BITRATE_OPTIONS = [
	{ value: "20", label: "20 Mbps — Qualità standard" },
	{ value: "50", label: "50 Mbps — Alta qualità" },
]

const EXPORT_ASPECT_OPTIONS = [
	{ value: "16:9", label: "16:9 — Widescreen" },
	{ value: "9:16", label: "9:16 — Verticale / Social media" },
]

const EXPORT_RESOLUTION_OPTIONS = [
	{ value: "1920x1080", label: "1080p — Full HD (1920 × 1080)" },
	{ value: "3840x2160", label: "4K — Ultra HD (3840 × 2160)" },
]

// ─── Helpers generici ────────────────────────────────────────────────────────

/** Formatta una data ISO in formato italiano leggibile (es. "31 marzo 2026") */
function formatDate(iso: string): string {
	if (!iso) return ""
	const d = new Date(iso)
	if (isNaN(d.getTime())) return iso
	return d.toLocaleDateString("it-IT", { day: "numeric", month: "long", year: "numeric" })
}

// ─── Helpers fascia / durata ─────────────────────────────────────────────────

/** Estrae {min, max} in minuti dall'etichetta della fascia. Restituisce null se non ha range. */
function parseTierRange(label: string): { min: number; max: number } | null {
	// "15 - 30 min", "2 - 4 min", "20 - 30 min", …
	const rangeMatch = label.match(/(\d+)\s*-\s*(\d+)\s*min/i)
	if (rangeMatch) return { min: Number(rangeMatch[1]), max: Number(rangeMatch[2]) }
	// "fino a 10 min"
	const upToMatch = label.match(/fino a\s+(\d+)\s*min/i)
	if (upToMatch) return { min: 1, max: Number(upToMatch[1]) }
	// "7+ min" o simili → nessun range significativo
	return null
}

/** Formatta i minuti in stringa leggibile (es. 2.5 → "2min 30s") */
function formatDuration(minutes: number): string {
	const mins = Math.floor(minutes)
	const secs = Math.round((minutes - mins) * 60)
	if (secs === 0) return `${mins} min`
	return `${mins}min ${secs}s`
}

// ─── Helpers prezzi ──────────────────────────────────────────────────────────

/** Prezzo del servizio per lo stato di selezione corrente (null = non ancora definibile) */
function getSelectedPrice(service: PublicService, sel: SelectedService): number | null {
	if (service.pricingType === "fixed") return service.basePrice != null ? Number(service.basePrice) : null
	if (service.pricingType === "tiered") {
		if (!sel.tierLabel) return null
		const tier = service.priceTiers?.find((t) => t.label === sel.tierLabel)
		return tier != null ? Number(tier.price) : null
	}
	return null // percentage: calcolato sul subtotale
}

/** Prezzo minimo del servizio (per la card non-selezionata) */
function getMinPrice(service: PublicService): number | null {
	if (service.pricingType === "fixed") return service.basePrice != null ? Number(service.basePrice) : null
	if (service.pricingType === "tiered") {
		const prices = (service.priceTiers ?? []).map((t) => Number(t.price))
		return prices.length ? Math.min(...prices) : null
	}
	return null
}

// ─── Componente ───────────────────────────────────────────────────────────────

const NewOrder = () => {
	const navigate = useNavigate()

	// Modalità batch
	const [isBatch, setIsBatch] = useState(false)
	const [batchEntries, setBatchEntries] = useState<{ coupleName: string; weddingDate: string }[]>([
		{ coupleName: "", weddingDate: "" },
	])

	// Singolo (retrocompat)
	const [coupleNames,         setCoupleNames]         = useState("")
	const [weddingDate,         setWeddingDate]         = useState("")
	const [desiredDeliveryDate, setDesiredDeliveryDate] = useState("")

	const [services,        setServices]        = useState<PublicService[]>([])
	const [loadingServices, setLoadingServices] = useState(true)
	const [selectedServices, setSelectedServices] = useState<SelectedService[]>([])

	const [deliveryMethod, setDeliveryMethod] = useState<DeliveryMethod | null>(null)
	const [materialLink,   setMaterialLink]   = useState("")
	const [materialSizeGb, setMaterialSizeGb] = useState("")

	const [generalNotes,   setGeneralNotes]   = useState("")
	const [referenceVideo, setReferenceVideo] = useState("")

	const [cameraCount, setCameraCount] = useState<CameraCount | null>(null)

	const [exportFps,        setExportFps]        = useState<string | null>(null)
	const [exportBitrate,    setExportBitrate]    = useState<string | null>(null)
	const [exportAspect,     setExportAspect]     = useState<string | null>(null)
	const [exportResolution, setExportResolution] = useState<string | null>(null)

	const [submitting, setSubmitting] = useState(false)

	useEffect(() => {
		genericGet("user/services")
			.then((data: PublicService[]) => setServices(data))
			.catch(() => toast.error("Impossibile caricare i servizi disponibili"))
			.finally(() => setLoadingServices(false))
	}, [])

	// ─── Batch helpers ───────────────────────────────────────────────────────

	const addBatchEntry = () => setBatchEntries((prev) => [...prev, { coupleName: "", weddingDate: "" }])

	const removeBatchEntry = (idx: number) =>
		setBatchEntries((prev) => prev.filter((_, i) => i !== idx))

	const updateBatchEntry = (idx: number, field: "coupleName" | "weddingDate", value: string) =>
		setBatchEntries((prev) => prev.map((e, i) => i === idx ? { ...e, [field]: value } : e))

	// ─── Helpers selezione ────────────────────────────────────────────────────

	const isSelected = (publicId: string) =>
		selectedServices.some((s) => s.publicId === publicId)

	const getSel = (publicId: string): SelectedService | undefined =>
		selectedServices.find((s) => s.publicId === publicId)

	const toggleService = (service: PublicService) => {
		if (isSelected(service.publicId)) {
			setSelectedServices((prev) => prev.filter((s) => s.publicId !== service.publicId))
			// Se un servizio principale viene deselezionato, rimuove anche gli extra collegati
			setSelectedServices((prev) =>
				prev.filter((s) => {
					const svc = services.find((sv) => sv.publicId === s.publicId)
					return svc?.restrictedToService !== service.publicId
				})
			)
		} else {
			setSelectedServices((prev) => [...prev, { publicId: service.publicId }])
		}
	}

	const selectTier = (publicId: string, tierLabel: string) => {
		const range = parseTierRange(tierLabel)
		setSelectedServices((prev) =>
			prev.map((s) =>
				s.publicId === publicId
					? { ...s, tierLabel, duration: range ? range.min : null }
					: s,
			),
		)
	}

	const changeDuration = (publicId: string, duration: number) => {
		setSelectedServices((prev) =>
			prev.map((s) => (s.publicId === publicId ? { ...s, duration } : s)),
		)
	}

	const changeNotes = (publicId: string, notes: string) => {
		setSelectedServices((prev) =>
			prev.map((s) => (s.publicId === publicId ? { ...s, notes } : s)),
		)
	}

	// ─── Visibilità extras ────────────────────────────────────────────────────

	const selectedPublicIds = new Set(selectedServices.map((s) => s.publicId))

	const isExtraVisible = (service: PublicService): boolean => {
		if (!service.restrictedToService) return true
		return selectedPublicIds.has(service.restrictedToService)
	}

	// ─── Calcolo prezzi ───────────────────────────────────────────────────────

	const mainExtraSubtotal = selectedServices.reduce((sum, sel) => {
		const svc = services.find((s) => s.publicId === sel.publicId)
		if (!svc || svc.category === "delivery") return sum
		return sum + (getSelectedPrice(svc, sel) ?? 0)
	}, 0)

	const deliverySvc = services.find(
		(s) => s.category === "delivery" && isSelected(s.publicId),
	)
	const fastDeliveryAmount = deliverySvc?.percentageValue != null
		? Math.round(mainExtraSubtotal * (Number(deliverySvc.percentageValue) / 100) * 100) / 100
		: 0

	const servicesTotal = mainExtraSubtotal + fastDeliveryAmount
	const cameraSurcharge = CAMERA_OPTIONS.find((o) => o.value === cameraCount)?.surcharge ?? 0
	const totalPrice = servicesTotal + cameraSurcharge

	const hasMissingTier = selectedServices.some((sel) => {
		const svc = services.find((s) => s.publicId === sel.publicId)
		return svc?.pricingType === "tiered" && !sel.tierLabel
	})

	// ─── Submit ───────────────────────────────────────────────────────────────

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault()

		// Validazione matrimoni
		if (isBatch) {
			for (let i = 0; i < batchEntries.length; i++) {
				if (!batchEntries[i].coupleName.trim()) { toast.error(`Inserisci il nome della coppia per il matrimonio ${i + 1}`); return }
				if (!batchEntries[i].weddingDate)       { toast.error(`Inserisci la data del matrimonio ${i + 1}`); return }
			}
		} else {
			if (!coupleNames.trim()) { toast.error("Inserisci il nome della coppia"); return }
			if (!weddingDate)        { toast.error("Inserisci la data del matrimonio"); return }
		}

		if (!desiredDeliveryDate)          { toast.error("Inserisci la data di consegna desiderata");      return }
		if (selectedServices.length === 0) { toast.error("Seleziona almeno un servizio");                  return }
		if (hasMissingTier)                { toast.error("Seleziona una fascia per ogni servizio scelto"); return }
		if (!deliveryMethod)               { toast.error("Seleziona come vuoi consegnare il materiale");   return }
		if (deliveryMethod === "cloud_link" && !materialLink.trim()) { toast.error("Inserisci il link al materiale"); return }
		if (!materialSizeGb.trim())        { toast.error("Inserisci la dimensione del materiale in GB");   return }
		if (!cameraCount)                  { toast.error("Indica il numero di telecamere utilizzate");     return }

		setSubmitting(true)
		try {
			// Costruisce il payload selectedServices arricchito
			const selectedServicesPayload = selectedServices.map((sel) => {
				const svc = services.find((s) => s.publicId === sel.publicId)!
				const entry: Record<string, any> = {
					publicId: sel.publicId,
					name: svc.name,
					pricingType: svc.pricingType,
					notes: sel.notes || undefined,
				}
				if (svc.pricingType === "tiered") {
					entry.tierLabel = sel.tierLabel
					entry.duration = sel.duration ?? null
					entry.price = svc.priceTiers?.find((t) => t.label === sel.tierLabel)?.price ?? 0
				} else if (svc.pricingType === "fixed") {
					entry.price = svc.basePrice ?? 0
				} else if (svc.pricingType === "percentage") {
					entry.percentageValue = svc.percentageValue
					entry.price = fastDeliveryAmount
				}
				return entry
			})

			const primaryCouple = isBatch ? batchEntries[0].coupleName.trim() : coupleNames.trim()
			const primaryDate   = isBatch ? batchEntries[0].weddingDate : weddingDate

			const payload: Record<string, any> = {
				coupleName: primaryCouple,
				weddingDate: primaryDate,
				desiredDeliveryDate,
				selectedServices: selectedServicesPayload,
				deliveryMethod,
				materialLink: deliveryMethod === "cloud_link" ? materialLink.trim() : null,
				materialSizeGb: Number(materialSizeGb),
				generalNotes: generalNotes.trim() || null,
				referenceVideo: referenceVideo.trim() || null,
				cameraCount,
				exportFps: exportFps || null,
				exportBitrate: exportBitrate || null,
				exportAspect: exportAspect || null,
				exportResolution: exportResolution || null,
				servicesTotal,
				cameraSurcharge,
				totalPrice,
			}

			if (isBatch && batchEntries.length > 1) {
				payload.entries = batchEntries.map((e) => ({ coupleName: e.coupleName.trim(), weddingDate: e.weddingDate }))
			}

			const result = await genericPost("user/orders", payload)
			toast.success("Ordine inviato con successo!")
			navigate(`/user/orders/${result.publicId}`)
		} catch {
			toast.error("Errore durante l'invio dell'ordine")
		} finally {
			setSubmitting(false)
		}
	}

	// ─── Render servizi ───────────────────────────────────────────────────────

	const mainServices     = services.filter((s) => s.category === "main")
	const extraServices    = services.filter((s) => s.category === "extra" && isExtraVisible(s))
	const deliveryServices = services.filter((s) => s.category === "delivery")

	const renderServiceCard = (service: PublicService) => {
		const selected = isSelected(service.publicId)
		const sel = getSel(service.publicId)
		const minPrice = getMinPrice(service)

		return (
			<div
				key={service.publicId}
				className={`rounded-xl border-2 p-4 transition-colors ${
					selected ? "border-[#7c3aed] bg-[#f5f3ff]" : "border-gray-200 bg-white"
				}`}
			>
				{/* Riga principale: checkbox + nome + prezzo */}
				<div className="flex items-start gap-3">
					<input
						id={`check-${service.publicId}`}
						type="checkbox"
						checked={selected}
						onChange={() => toggleService(service)}
						className="mt-1 rounded border-gray-300 text-[#7c3aed] focus:ring-[#7c3aed] cursor-pointer"
					/>
					<label htmlFor={`check-${service.publicId}`} className="flex-1 min-w-0 cursor-pointer">
						<div className="flex flex-wrap items-center gap-2">
							<span className="font-semibold text-gray-900">{service.name}</span>
							{service.durationDescription && (
								<span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
									{service.durationDescription}
								</span>
							)}
						</div>
						<p className="text-sm text-gray-500 mt-0.5">{service.description}</p>

						{/* Prezzo quando non selezionato */}
						{!selected && (
							<p className="mt-1.5 text-sm font-semibold text-gray-800">
								{service.pricingType === "percentage" && service.percentageValue != null ? (
									<span className="text-[#7c3aed]">+{service.percentageValue}%</span>
								) : service.pricingType === "tiered" && (service.priceTiers?.length ?? 0) > 1 ? (
									<>
										a partire da{" "}
										<span className="text-gray-900">
											€{Math.min(...(service.priceTiers ?? []).map((t) => t.price)).toFixed(2)}
										</span>
									</>
								) : minPrice != null ? (
									`€${minPrice.toFixed(2)}`
								) : (
									<span className="font-normal text-gray-400 italic">Preventivo su richiesta</span>
								)}
							</p>
						)}
					</label>
				</div>

				{/* Sezione espansa quando selezionato */}
				{selected && (
					<div className="mt-4 ml-7 space-y-4">

						{/* Selettore fasce (tiered) */}
						{service.pricingType === "tiered" && (service.priceTiers ?? []).length > 0 && (
							<div className="space-y-2">
								<p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Seleziona fascia</p>
								<div className="flex flex-wrap gap-2">
									{(service.priceTiers ?? []).map((tier) => {
										const active = sel?.tierLabel === tier.label
										return (
											<button
												key={tier.label}
												type="button"
												onClick={() => selectTier(service.publicId, tier.label)}
												className={`flex items-center gap-2 px-3 py-2 rounded-lg border-2 text-sm transition-all ${
													active
														? "border-[#7c3aed] bg-[#7c3aed] text-white"
														: "border-gray-200 bg-white text-gray-700 hover:border-[#c4b5fd]"
												}`}
											>
												<span>{tier.label}</span>
												<span className={`font-bold ${active ? "text-white" : "text-gray-900"}`}>
													€{tier.price.toFixed(2)}
												</span>
											</button>
										)
									})}
								</div>
								{!sel?.tierLabel && (
									<p className="text-xs text-amber-600">
										<i className="fa-solid fa-triangle-exclamation mr-1" />
										Seleziona una fascia per continuare
									</p>
								)}

								{/* Slider durata — visibile solo se la fascia selezionata ha un range */}
								{(() => {
									if (!sel?.tierLabel) return null
									const range = parseTierRange(sel.tierLabel)
									if (!range) return null
									const step = (range.max - range.min) < 5 ? 0.5 : 1
									const value = sel.duration ?? range.min
									return (
										<div className="mt-3 space-y-1.5">
											<div className="flex items-center justify-between">
												<p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Durata stimata</p>
												<span className="text-sm font-semibold text-[#7c3aed]">{formatDuration(value)}</span>
											</div>
											<input
												type="range"
												min={range.min}
												max={range.max}
												step={step}
												value={value}
												onChange={(e) => changeDuration(service.publicId, Number(e.target.value))}
												className="w-full h-2 rounded-lg appearance-none cursor-pointer accent-[#7c3aed] bg-gray-200"
											/>
											<div className="flex justify-between text-xs text-gray-400">
												<span>{formatDuration(range.min)}</span>
												<span>{formatDuration(range.max)}</span>
											</div>
										</div>
									)
								})()}
							</div>
						)}

						{/* Prezzo fisso selezionato */}
						{service.pricingType === "fixed" && service.basePrice != null && (
							<p className="text-sm font-semibold text-[#6d28d9]">
								€{service.basePrice.toFixed(2)}
							</p>
						)}

						{/* Fast Delivery: mostra percentuale + importo calcolato */}
						{service.pricingType === "percentage" && service.percentageValue != null && (
							<p className="text-sm text-[#6d28d9]">
								<span className="font-semibold">+{Number(service.percentageValue)}%</span>
								{mainExtraSubtotal > 0 && (
									<span className="text-gray-500 ml-1">
										= €{fastDeliveryAmount.toFixed(2)} sul subtotale attuale
									</span>
								)}
							</p>
						)}

						{/* Note aggiuntive */}
						<Textarea
							name={`notes-${service.publicId}`}
							label="Specifiche aggiuntive"
							rows={2}
							value={sel?.notes ?? ""}
							onChange={(e) => changeNotes(service.publicId, e.target.value)}
							placeholder="Eventuali richieste specifiche per questo servizio…"
						/>
					</div>
				)}
			</div>
		)
	}

	// ─── Render ───────────────────────────────────────────────────────────────

	return (
		<div className="min-h-[calc(100vh-3.5rem)] relative">
			<form onSubmit={handleSubmit}>
				<div className="container mx-auto px-4 py-6 md:py-8 relative">
					<div className="flex flex-col lg:flex-row gap-8">

						{/* ── Colonna sinistra ── */}
						<section className="flex-1 max-w-4xl space-y-6">

							{/* Intestazione progetto */}
							<div className="rounded-xl border border-gray-200 bg-white shadow-sm p-6 md:p-8 space-y-6">
								<div className="flex flex-wrap items-center justify-between gap-3">
									<h1 className="text-2xl font-bold text-[#6d28d9]">Nuovo progetto</h1>
									{/* Toggle singolo / batch */}
									<div className="flex items-center bg-gray-100 rounded-lg p-1 gap-0.5">
										<button
											type="button"
											onClick={() => setIsBatch(false)}
											className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors cursor-pointer ${!isBatch ? "bg-white text-[#7c3aed] shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
										>
											<i className="fa-solid fa-rings-wedding mr-1.5 text-xs" />
											Singolo
										</button>
										<button
											type="button"
											onClick={() => setIsBatch(true)}
											className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors cursor-pointer ${isBatch ? "bg-white text-[#7c3aed] shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
										>
											<i className="fa-solid fa-layer-group mr-1.5 text-xs" />
											Batch
										</button>
									</div>
								</div>

								{isBatch ? (
									/* Modalità batch: righe dinamiche */
									<div className="space-y-3">
										<p className="text-sm text-gray-500">Aggiungi tutti i matrimoni che condividono gli stessi servizi.</p>
										{batchEntries.map((entry, idx) => (
											<div key={idx} className="flex items-end gap-2 p-3 rounded-lg border border-gray-200 bg-gray-50">
												<div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-3">
													<Input
														name={`batch-couple-${idx}`}
														type="text"
														label={`Coppia ${idx + 1}`}
														value={entry.coupleName}
														onChange={(e) => updateBatchEntry(idx, "coupleName", e.target.value)}
														placeholder="Es. Mario e Laura"
													/>
													<DateTimePicker
														label="Data matrimonio"
														value={entry.weddingDate || null}
														onChange={(date) => updateBatchEntry(idx, "weddingDate", date ?? "")}
													/>
												</div>
												{idx > 0 && (
													<button
														type="button"
														onClick={() => removeBatchEntry(idx)}
														className="mb-1 flex items-center justify-center w-8 h-8 rounded-lg border border-red-200 text-red-500 hover:bg-red-50 transition-colors cursor-pointer shrink-0"
													>
														<i className="fa-solid fa-times text-xs" />
													</button>
												)}
											</div>
										))}
										<button
											type="button"
											onClick={addBatchEntry}
											className="w-full flex items-center justify-center gap-2 py-2 rounded-lg border border-dashed border-[#c4b5fd] text-[#7c3aed] text-sm font-medium hover:bg-[#f5f3ff] transition-colors cursor-pointer"
										>
											<i className="fa-solid fa-plus text-xs" />
											Aggiungi matrimonio
										</button>
										<DateTimePicker
											label="Data di consegna desiderata (comune)"
											value={desiredDeliveryDate || null}
											onChange={(date) => setDesiredDeliveryDate(date ?? "")}
										/>
									</div>
								) : (
									/* Modalità singola */
									<div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-end">
										<div className="sm:col-span-2">
											<Input
												name="coupleNames"
												type="text"
												label="Nomi della coppia"
												value={coupleNames}
												onChange={(e) => setCoupleNames(e.target.value)}
												placeholder="Ad es. «Mario e Laura». Sarà il nome del progetto."
											/>
										</div>
										<div>
											<DateTimePicker
												label="Data del matrimonio"
												value={weddingDate || null}
												onChange={(date) => setWeddingDate(date ?? "")}
											/>
										</div>
										<div>
											<DateTimePicker
												label="Data di consegna desiderata"
												value={desiredDeliveryDate || null}
												onChange={(date) => setDesiredDeliveryDate(date ?? "")}
											/>
										</div>
									</div>
								)}
							</div>

							{/* Selezione servizi */}
							<div className="rounded-xl border border-gray-200 bg-white shadow-sm p-6 md:p-8 space-y-4">
								<div>
									<h2 className="text-lg font-semibold text-gray-900">Servizi</h2>
									<p className="text-sm text-gray-500 mt-0.5">Seleziona i servizi da includere nel progetto.</p>
								</div>

								{loadingServices ? (
									<div className="flex items-center gap-3 py-8 text-gray-500">
										<i className="fa-solid fa-spinner fa-spin text-[#7c3aed]" />
										<span>Caricamento servizi in corso…</span>
									</div>
								) : services.length === 0 ? (
									<p className="py-8 text-center text-gray-400 text-sm">Nessun servizio disponibile al momento.</p>
								) : (
									<div className="space-y-6">

										{/* Servizi principali */}
										{mainServices.length > 0 && (
											<div className="space-y-3">
												{mainServices.map(renderServiceCard)}
											</div>
										)}

										{/* Extra */}
										{extraServices.length > 0 && (
											<div className="space-y-3">
												<div className="flex items-center gap-3">
													<div className="h-px flex-1 bg-gray-100" />
													<span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Extra</span>
													<div className="h-px flex-1 bg-gray-100" />
												</div>
												{extraServices.map(renderServiceCard)}
											</div>
										)}

										{/* Consegna */}
										{deliveryServices.length > 0 && (
											<div className="space-y-3">
												<div className="flex items-center gap-3">
													<div className="h-px flex-1 bg-gray-100" />
													<span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Consegna</span>
													<div className="h-px flex-1 bg-gray-100" />
												</div>
												{deliveryServices.map(renderServiceCard)}
											</div>
										)}

									</div>
								)}
							</div>

							{/* Materiale */}
							<div className="rounded-xl border border-gray-200 bg-white shadow-sm p-6 md:p-8 space-y-4">
								<div>
									<h2 className="text-lg font-semibold text-gray-900">Materiale</h2>
									<p className="text-sm text-gray-500 mt-0.5">Indica come vuoi consegnarci il materiale video.</p>
								</div>
								<div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
									{(["cloud_link", "upload_request"] as const).map((method) => {
										const active = deliveryMethod === method
										const icon  = method === "cloud_link" ? "fa-cloud" : "fa-cloud-arrow-up"
										const title = method === "cloud_link" ? "Ho già caricato il materiale" : "Richiedi link di caricamento"
										const desc  = method === "cloud_link"
											? "Fornisci il link alla cartella cloud con tutti i file."
											: "Ti invieremo un link dove potrai caricare il materiale."
										return (
											<label
												key={method}
												htmlFor={`delivery-${method}`}
												className={`flex items-start gap-3 p-4 rounded-lg border-2 cursor-pointer transition-all ${active ? "border-[#7c3aed] bg-[#f5f3ff]" : "border-gray-200 bg-white hover:border-[#ddd6fe] hover:bg-gray-50"}`}
											>
												<input id={`delivery-${method}`} type="radio" name="deliveryMethod" value={method} checked={active} onChange={() => setDeliveryMethod(method)} className="sr-only" />
												<i className={`fa-solid ${icon} text-xl mt-0.5 shrink-0 ${active ? "text-[#7c3aed]" : "text-gray-400"}`} aria-hidden />
												<div>
													<p className={`font-medium ${active ? "text-[#6d28d9]" : "text-gray-900"}`}>{title}</p>
													<p className="text-sm text-gray-500 mt-0.5">{desc}</p>
												</div>
											</label>
										)
									})}
								</div>
								{deliveryMethod === "cloud_link" && (
									<Input
										name="materialLink"
										type="url"
										label="Link cartella cloud *"
										value={materialLink}
										onChange={(e) => setMaterialLink(e.target.value)}
										placeholder="Es. https://drive.google.com/drive/folders/..."
									/>
								)}
								<Input
									name="materialSizeGb"
									type="number"
									label="Dimensione totale materiale (GB) *"
									value={materialSizeGb}
									onChange={(e) => setMaterialSizeGb(e.target.value)}
									placeholder="Es. 25.5"
								/>
							</div>

							{/* Note */}
							<div className="rounded-xl border border-gray-200 bg-white shadow-sm p-6 md:p-8 space-y-4">
								<h2 className="text-lg font-semibold text-gray-900">Note</h2>
								<Textarea
									name="generalNotes"
									label="Note generali"
									rows={4}
									value={generalNotes}
									onChange={(e) => setGeneralNotes(e.target.value)}
									placeholder="Stile di montaggio, preferenze musicali, momenti da includere o escludere, etc."
								/>
								<Textarea
									name="referenceVideo"
									label="Video di riferimento"
									rows={3}
									value={referenceVideo}
									onChange={(e) => setReferenceVideo(e.target.value)}
									placeholder="Link o descrizione di video che vorresti usare come riferimento stilistico."
								/>
							</div>

							{/* Telecamere */}
							<div className="rounded-xl border border-gray-200 bg-white shadow-sm p-6 md:p-8 space-y-4">
								<div>
									<h2 className="text-lg font-semibold text-gray-900">Telecamere</h2>
									<p className="text-sm text-gray-500 mt-0.5">Quante telecamere sono state utilizzate? Il numero influisce sul costo del montaggio.</p>
								</div>
								<div className="grid grid-cols-3 gap-3">
									{CAMERA_OPTIONS.map((opt) => {
										const active = cameraCount === opt.value
										return (
											<label
												key={opt.value}
												htmlFor={`camera-${opt.value}`}
												className={`flex flex-col items-center gap-2 p-4 rounded-lg border-2 cursor-pointer transition-all text-center ${active ? "border-[#7c3aed] bg-[#f5f3ff]" : "border-gray-200 bg-white hover:border-[#ddd6fe] hover:bg-gray-50"}`}
											>
												<input id={`camera-${opt.value}`} type="radio" name="cameraCount" value={opt.value} checked={active} onChange={() => setCameraCount(opt.value)} className="sr-only" />
												<i className={`fa-solid fa-video text-2xl ${active ? "text-[#7c3aed]" : "text-gray-400"}`} aria-hidden />
												<span className={`font-semibold text-lg ${active ? "text-[#6d28d9]" : "text-gray-900"}`}>{opt.label}</span>
												{opt.surcharge > 0
													? <span className={`text-xs font-medium ${active ? "text-[#7c3aed]" : "text-orange-500"}`}>+€{opt.surcharge}</span>
													: <span className="text-xs text-gray-400">Incluso</span>
												}
											</label>
										)
									})}
								</div>
							</div>

							{/* Impostazioni di esportazione */}
							<div className="rounded-xl border border-gray-200 bg-white shadow-sm p-6 md:p-8 space-y-4">
								<div>
									<h2 className="text-lg font-semibold text-gray-900">Impostazioni di esportazione</h2>
									<p className="text-sm text-gray-500 mt-0.5">Specifica il formato tecnico desiderato per i file finali. Se non hai preferenze puoi lasciare i campi vuoti.</p>
								</div>
								<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
									<Select colorScheme="brown" name="exportFps"        label="Frame rate (FPS)"      value={exportFps}        onChange={(e) => setExportFps(e.target.value as string | null)}        options={EXPORT_FPS_OPTIONS}        placeholder="Seleziona FPS"         />
									<Select colorScheme="brown" name="exportBitrate"    label="Bitrate (Mbps)"        value={exportBitrate}    onChange={(e) => setExportBitrate(e.target.value as string | null)}    options={EXPORT_BITRATE_OPTIONS}    placeholder="Seleziona bitrate"     />
									<Select colorScheme="brown" name="exportAspect"     label="Formato (aspect ratio)" value={exportAspect}    onChange={(e) => setExportAspect(e.target.value as string | null)}     options={EXPORT_ASPECT_OPTIONS}     placeholder="Seleziona formato"    />
									<Select colorScheme="brown" name="exportResolution" label="Risoluzione"            value={exportResolution} onChange={(e) => setExportResolution(e.target.value as string | null)} options={EXPORT_RESOLUTION_OPTIONS} placeholder="Seleziona risoluzione" />
								</div>
							</div>

						</section>

						{/* ── Colonna destra: riepilogo ── */}
						<aside className="lg:w-80 shrink-0">
							<div className="lg:sticky lg:top-24 rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
								<div className="bg-[#ede9fe] px-4 py-3 border-b border-[#ddd6fe]">
									<h2 className="text-lg font-semibold text-[#6d28d9]">Riepilogo</h2>
								</div>
								<div className="p-4 space-y-3">
									{coupleNames && (
										<div className="text-sm text-gray-700">
											<span className="font-medium">Coppia:</span> {coupleNames}
										</div>
									)}
									{weddingDate && (
										<div className="text-sm text-gray-700">
											<span className="font-medium">Matrimonio:</span> {formatDate(weddingDate)}
										</div>
									)}
									{desiredDeliveryDate && (
										<div className="text-sm text-gray-700">
											<span className="font-medium">Consegna desiderata:</span> {formatDate(desiredDeliveryDate)}
										</div>
									)}

									{selectedServices.length > 0 ? (
										<>
											<div className="border-t border-gray-100 pt-3 space-y-2">
												{selectedServices.map((sel) => {
													const svc = services.find((s) => s.publicId === sel.publicId)
													if (!svc) return null

													let priceLabel: React.ReactNode
													if (svc.pricingType === "tiered") {
														const rawPrice = sel.tierLabel
															? svc.priceTiers?.find((t) => t.label === sel.tierLabel)?.price
															: null
														const price = rawPrice != null ? Number(rawPrice) : null
														priceLabel = price != null
															? `€${price.toFixed(2)}`
															: <em className="text-amber-500 font-normal text-xs">fascia non scelta</em>
													} else if (svc.pricingType === "fixed") {
														priceLabel = svc.basePrice != null ? `€${Number(svc.basePrice).toFixed(2)}` : "—"
													} else if (svc.pricingType === "percentage") {
														priceLabel = (
															<span className="text-[#7c3aed]">
																+{svc.percentageValue}%
																{fastDeliveryAmount > 0 && ` (€${fastDeliveryAmount.toFixed(2)})`}
															</span>
														)
													}

													return (
														<div key={sel.publicId} className="flex justify-between items-start text-sm gap-2">
															<span className="text-gray-700 leading-snug">
																{svc.name}
																{sel.tierLabel && (
																	<span className="block text-xs text-gray-400">
																		{sel.tierLabel}
																		{sel.duration != null && ` · ${formatDuration(sel.duration)}`}
																	</span>
																)}
															</span>
															<span className="font-medium text-gray-900 shrink-0">{priceLabel}</span>
														</div>
													)
												})}

												{cameraSurcharge > 0 && (
													<div className="flex justify-between items-center text-sm gap-2">
														<span className="text-gray-700">
															Telecamere ({cameraCount})
															<span className="block text-xs text-gray-400">Supplemento multi-camera</span>
														</span>
														<span className="font-medium text-orange-600 shrink-0">+€{cameraSurcharge.toFixed(2)}</span>
													</div>
												)}
											</div>

											<div className="border-t border-gray-200 pt-3 flex justify-between font-semibold text-base">
												<span className="text-gray-800">Totale</span>
												<span className="text-[#7c3aed]">€{totalPrice.toFixed(2)}</span>
											</div>

											{hasMissingTier && (
												<p className="text-xs text-amber-600">
													<i className="fa-solid fa-triangle-exclamation mr-1" />
													Seleziona le fasce mancanti per completare il totale.
												</p>
											)}
										</>
									) : (
										<p className="text-sm text-gray-400 italic">Nessun servizio selezionato.</p>
									)}
								</div>

								<div className="px-4 pb-4">
									<button
										type="submit"
										disabled={submitting || loadingServices}
										className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-[#7c3aed] text-white font-medium hover:bg-[#6d28d9] disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer"
									>
										{submitting
											? <><i className="fa-solid fa-spinner fa-spin" /> Invio in corso…</>
											: <><i className="fa-solid fa-paper-plane" /> Invia ordine</>
										}
									</button>
								</div>
							</div>
						</aside>

					</div>

					<div className="absolute bottom-4 right-4 text-gray-200/30 text-5xl font-bold select-none pointer-events-none hidden md:block">
						WeddingCut
					</div>
				</div>
			</form>
		</div>
	)
}

export default NewOrder
