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
	tierLabel?: string | null
	duration?: number | null
	notes?: string
}

interface EntryForm {
	coupleName: string
	weddingDate: string
	selectedServices: SelectedService[]
	deliveryMethod: "cloud_link" | "upload_request" | null
	materialLink: string
	materialSizeGb: string
	cameraCount: "1-4" | "5-6" | "7+" | null
	exportFps: string | null
	exportBitrate: string | null
	exportAspect: string | null
	exportResolution: string | null
}

// ─── Costanti ─────────────────────────────────────────────────────────────────

const CAMERA_OPTIONS: { value: "1-4" | "5-6" | "7+"; label: string; surcharge: number }[] = [
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

// ─── Helper entry vuota ───────────────────────────────────────────────────────

const defaultEntry = (): EntryForm => ({
	coupleName: "", weddingDate: "", selectedServices: [],
	deliveryMethod: null, materialLink: "", materialSizeGb: "",
	cameraCount: null, exportFps: null, exportBitrate: null,
	exportAspect: null, exportResolution: null,
})

// ─── Helpers formattazione ────────────────────────────────────────────────────

function formatDate(iso: string): string {
	if (!iso) return ""
	const d = new Date(iso)
	if (isNaN(d.getTime())) return iso
	return d.toLocaleDateString("it-IT", { day: "numeric", month: "long", year: "numeric" })
}

function parseTierRange(label: string): { min: number; max: number } | null {
	const rangeMatch = label.match(/(\d+)\s*-\s*(\d+)\s*min/i)
	if (rangeMatch) return { min: Number(rangeMatch[1]), max: Number(rangeMatch[2]) }
	const upToMatch = label.match(/fino a\s+(\d+)\s*min/i)
	if (upToMatch) return { min: 1, max: Number(upToMatch[1]) }
	return null
}

function formatDuration(minutes: number): string {
	const mins = Math.floor(minutes)
	const secs = Math.round((minutes - mins) * 60)
	if (secs === 0) return `${mins} min`
	return `${mins}min ${secs}s`
}

// ─── Helpers prezzi ──────────────────────────────────────────────────────────

function getSelectedPrice(service: PublicService, sel: SelectedService): number | null {
	if (service.pricingType === "fixed") return service.basePrice != null ? Number(service.basePrice) : null
	if (service.pricingType === "tiered") {
		if (!sel.tierLabel) return null
		const tier = service.priceTiers?.find((t) => t.label === sel.tierLabel)
		return tier != null ? Number(tier.price) : null
	}
	return null
}

function getMinPrice(service: PublicService): number | null {
	if (service.pricingType === "fixed") return service.basePrice != null ? Number(service.basePrice) : null
	if (service.pricingType === "tiered") {
		const prices = (service.priceTiers ?? []).map((t) => Number(t.price))
		return prices.length ? Math.min(...prices) : null
	}
	return null
}

function calcEntryMainSubtotal(entry: EntryForm, services: PublicService[]): number {
	return entry.selectedServices.reduce((sum, sel) => {
		const svc = services.find((s) => s.publicId === sel.publicId)
		if (!svc || svc.category === "delivery") return sum
		return sum + (getSelectedPrice(svc, sel) ?? 0)
	}, 0)
}

function calcEntryFastDelivery(entry: EntryForm, services: PublicService[], mainSubtotal: number): number {
	const deliverySvc = services.find(
		(s) => s.category === "delivery" && entry.selectedServices.some((sel) => sel.publicId === s.publicId),
	)
	if (deliverySvc?.percentageValue == null) return 0
	return Math.round(mainSubtotal * (Number(deliverySvc.percentageValue) / 100) * 100) / 100
}

function calcEntryTotal(entry: EntryForm, services: PublicService[]): number {
	const main = calcEntryMainSubtotal(entry, services)
	const fd = calcEntryFastDelivery(entry, services, main)
	const cs = CAMERA_OPTIONS.find((o) => o.value === entry.cameraCount)?.surcharge ?? 0
	return main + fd + cs
}

function buildServicesPayload(entry: EntryForm, services: PublicService[]) {
	const main = calcEntryMainSubtotal(entry, services)
	const fd = calcEntryFastDelivery(entry, services, main)
	return entry.selectedServices.map((sel) => {
		const svc = services.find((s) => s.publicId === sel.publicId)!
		const item: Record<string, any> = {
			publicId: sel.publicId,
			name: svc.name,
			pricingType: svc.pricingType,
			notes: sel.notes || undefined,
		}
		if (svc.pricingType === "tiered") {
			item.tierLabel = sel.tierLabel
			item.duration = sel.duration ?? null
			item.price = svc.priceTiers?.find((t) => t.label === sel.tierLabel)?.price ?? 0
		} else if (svc.pricingType === "fixed") {
			item.price = svc.basePrice ?? 0
		} else if (svc.pricingType === "percentage") {
			item.percentageValue = svc.percentageValue
			item.price = fd
		}
		return item
	})
}

// ─── Componente ───────────────────────────────────────────────────────────────

const NewOrder = () => {
	const navigate = useNavigate()

	// Stato entries (ogni matrimonio ha la propria config)
	const [entries, setEntries] = useState<EntryForm[]>([defaultEntry()])
	const [selectedIdx, setSelectedIdx] = useState(0)
	const [isMulti, setIsMulti] = useState(false)

	// Campi condivisi (a livello ordine)
	const [generalNotes, setGeneralNotes]   = useState("")
	const [referenceVideo, setReferenceVideo] = useState("")

	const [services,        setServices]        = useState<PublicService[]>([])
	const [loadingServices, setLoadingServices] = useState(true)
	const [submitting,      setSubmitting]      = useState(false)
	const [confirmDeleteIdx, setConfirmDeleteIdx] = useState<number | null>(null)

	useEffect(() => {
		genericGet("user/services")
			.then((data: PublicService[]) => setServices(data))
			.catch(() => toast.error("Impossibile caricare i servizi disponibili"))
			.finally(() => setLoadingServices(false))
	}, [])

	// ─── Entry helpers ────────────────────────────────────────────────────────

	const currentEntry = entries[selectedIdx] ?? defaultEntry()

	const updateCurrentEntry = <K extends keyof EntryForm>(key: K, value: EntryForm[K]) =>
		setEntries((prev) => prev.map((e, i) => (i === selectedIdx ? { ...e, [key]: value } : e)))

	const addEntry = () => {
		setEntries((prev) => [...prev, defaultEntry()])
		setSelectedIdx(entries.length)
		setIsMulti(true)
	}

	const duplicateEntry = (idx: number) => {
		const copy: EntryForm = {
			...JSON.parse(JSON.stringify(entries[idx])),
			coupleName: "",
			weddingDate: "",
		}
		setEntries((prev) => [...prev, copy])
		setSelectedIdx(entries.length)
		setIsMulti(true)
	}

	const removeEntry = (idx: number) => {
		if (entries.length <= 1) return
		const next = entries.filter((_, i) => i !== idx)
		setEntries(next)
		setSelectedIdx(Math.min(selectedIdx, next.length - 1))
		setConfirmDeleteIdx(null)
	}

	const moveEntry = (idx: number, dir: "up" | "down") => {
		const newIdx = dir === "up" ? idx - 1 : idx + 1
		if (newIdx < 0 || newIdx >= entries.length) return
		const next = [...entries]
		;[next[idx], next[newIdx]] = [next[newIdx], next[idx]]
		setEntries(next)
		if (selectedIdx === idx) setSelectedIdx(newIdx)
		else if (selectedIdx === newIdx) setSelectedIdx(idx)
	}

	// ─── Helpers selezione servizi ────────────────────────────────────────────

	const isSelected = (publicId: string) =>
		currentEntry.selectedServices.some((s) => s.publicId === publicId)

	const getSel = (publicId: string): SelectedService | undefined =>
		currentEntry.selectedServices.find((s) => s.publicId === publicId)

	const toggleService = (service: PublicService) => {
		const current = currentEntry.selectedServices
		if (isSelected(service.publicId)) {
			const next = current
				.filter((s) => s.publicId !== service.publicId)
				.filter((s) => {
					const svc = services.find((sv) => sv.publicId === s.publicId)
					return svc?.restrictedToService !== service.publicId
				})
			updateCurrentEntry("selectedServices", next)
		} else {
			updateCurrentEntry("selectedServices", [...current, { publicId: service.publicId }])
		}
	}

	const selectTier = (publicId: string, tierLabel: string) => {
		const range = parseTierRange(tierLabel)
		updateCurrentEntry(
			"selectedServices",
			currentEntry.selectedServices.map((s) =>
				s.publicId === publicId
					? { ...s, tierLabel, duration: range ? range.min : null }
					: s,
			),
		)
	}

	const changeDuration = (publicId: string, duration: number) => {
		updateCurrentEntry(
			"selectedServices",
			currentEntry.selectedServices.map((s) =>
				s.publicId === publicId ? { ...s, duration } : s,
			),
		)
	}

	const changeNotes = (publicId: string, notes: string) => {
		updateCurrentEntry(
			"selectedServices",
			currentEntry.selectedServices.map((s) =>
				s.publicId === publicId ? { ...s, notes } : s,
			),
		)
	}

	// ─── Visibilità extras ────────────────────────────────────────────────────

	const selectedPublicIds = new Set(currentEntry.selectedServices.map((s) => s.publicId))

	const isExtraVisible = (service: PublicService): boolean => {
		if (!service.restrictedToService) return true
		return selectedPublicIds.has(service.restrictedToService)
	}

	// ─── Calcolo prezzi entry corrente ────────────────────────────────────────

	const mainExtraSubtotal = calcEntryMainSubtotal(currentEntry, services)
	const fastDeliveryAmount = calcEntryFastDelivery(currentEntry, services, mainExtraSubtotal)
	const entryServicesTotal = mainExtraSubtotal + fastDeliveryAmount
	const cameraSurcharge = CAMERA_OPTIONS.find((o) => o.value === currentEntry.cameraCount)?.surcharge ?? 0
	const entryTotalPrice = entryServicesTotal + cameraSurcharge

	// Totale ordine (somma di tutte le entries)
	const orderTotalPrice = entries.reduce((sum, e) => sum + calcEntryTotal(e, services), 0)

	const hasMissingTier = currentEntry.selectedServices.some((sel) => {
		const svc = services.find((s) => s.publicId === sel.publicId)
		return svc?.pricingType === "tiered" && !sel.tierLabel
	})

	// ─── Submit ───────────────────────────────────────────────────────────────

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault()

		// Validazione per ogni entry
		for (let i = 0; i < entries.length; i++) {
			const entry = entries[i]
			const label = entries.length > 1 ? ` (matrimonio ${i + 1})` : ""
			if (!entry.coupleName.trim())        { toast.error(`Inserisci il nome della coppia${label}`); return }
			if (!entry.weddingDate)              { toast.error(`Inserisci la data del matrimonio${label}`); return }
			if (entry.selectedServices.length === 0) { toast.error(`Seleziona almeno un servizio${label}`); return }
			const missingTier = entry.selectedServices.some((sel) => {
				const svc = services.find((s) => s.publicId === sel.publicId)
				return svc?.pricingType === "tiered" && !sel.tierLabel
			})
			if (missingTier)                     { toast.error(`Seleziona le fasce mancanti${label}`); return }
			if (!entry.deliveryMethod)           { toast.error(`Seleziona come vuoi consegnare il materiale${label}`); return }
			if (entry.deliveryMethod === "cloud_link" && !entry.materialLink.trim()) {
				toast.error(`Inserisci il link al materiale${label}`); return
			}
			if (!entry.materialSizeGb.trim())    { toast.error(`Inserisci la dimensione del materiale in GB${label}`); return }
			if (!entry.cameraCount)              { toast.error(`Indica il numero di telecamere${label}`); return }
		}

		setSubmitting(true)
		try {
			const entriesPayload = entries.map((entry) => {
				const main = calcEntryMainSubtotal(entry, services)
				const fd = calcEntryFastDelivery(entry, services, main)
				const cs = CAMERA_OPTIONS.find((o) => o.value === entry.cameraCount)?.surcharge ?? 0
				return {
					coupleName:       entry.coupleName.trim(),
					weddingDate:      entry.weddingDate,
					selectedServices: buildServicesPayload(entry, services),
					deliveryMethod:   entry.deliveryMethod,
					materialLink:     entry.deliveryMethod === "cloud_link" ? entry.materialLink.trim() : null,
					materialSizeGb:   Number(entry.materialSizeGb),
					cameraCount:      entry.cameraCount,
					exportFps:        entry.exportFps,
					exportBitrate:    entry.exportBitrate,
					exportAspect:     entry.exportAspect,
					exportResolution: entry.exportResolution,
					servicesTotal:    main + fd,
					cameraSurcharge:  cs,
					totalPrice:       main + fd + cs,
				}
			})

			const first = entriesPayload[0]
			const payload: Record<string, any> = {
				generalNotes:     generalNotes.trim() || null,
				referenceVideo:   referenceVideo.trim() || null,
				// Prima entry come retrocompat ordine padre
				coupleName:       first.coupleName,
				weddingDate:      first.weddingDate,
				deliveryMethod:   first.deliveryMethod,
				materialLink:     first.materialLink,
				materialSizeGb:   first.materialSizeGb,
				cameraCount:      first.cameraCount,
				exportFps:        first.exportFps,
				exportBitrate:    first.exportBitrate,
				exportAspect:     first.exportAspect,
				exportResolution: first.exportResolution,
				selectedServices: first.selectedServices,
				servicesTotal:    first.servicesTotal,
				cameraSurcharge:  first.cameraSurcharge,
				totalPrice:       orderTotalPrice,
				isBatch:          isMulti ? 1 : 0,
				entries:          entriesPayload,
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
				<div className="flex items-start gap-3">
					<input
						id={`check-${service.publicId}-${selectedIdx}`}
						type="checkbox"
						checked={selected}
						onChange={() => toggleService(service)}
						className="mt-1 rounded border-gray-300 text-[#7c3aed] focus:ring-[#7c3aed] cursor-pointer"
					/>
					<label htmlFor={`check-${service.publicId}-${selectedIdx}`} className="flex-1 min-w-0 cursor-pointer">
						<div className="flex flex-wrap items-center gap-2">
							<span className="font-semibold text-gray-900">{service.name}</span>
							{service.durationDescription && (
								<span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
									{service.durationDescription}
								</span>
							)}
						</div>
						<p className="text-sm text-gray-500 mt-0.5">{service.description}</p>

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

				{selected && (
					<div className="mt-4 ml-7 space-y-4">
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

						{service.pricingType === "fixed" && service.basePrice != null && (
							<p className="text-sm font-semibold text-[#6d28d9]">
								€{service.basePrice.toFixed(2)}
							</p>
						)}

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

						<Textarea
							name={`notes-${service.publicId}-${selectedIdx}`}
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

	// ─── Sezione config per-entry (usata sia nel pannello centro che nella colonna sinistra singola) ───

	const renderCoupleHeader = () => (
		<div className="rounded-xl border border-gray-200 bg-white shadow-sm p-6">
			<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
				<div>
					<Input
						name={`coupleName-${selectedIdx}`}
						type="text"
						label="Nomi della coppia *"
						value={currentEntry.coupleName}
						onChange={(e) => updateCurrentEntry("coupleName", e.target.value)}
						placeholder="Es. Mario e Laura"
					/>
				</div>
				<div>
					<DateTimePicker
						label="Data del matrimonio *"
						value={currentEntry.weddingDate || null}
						onChange={(date) => updateCurrentEntry("weddingDate", date ?? "")}
					/>
				</div>
			</div>
		</div>
	)

	const renderEntryConfig = (showCoupleHeader = true) => (
		<>
			{showCoupleHeader && renderCoupleHeader()}

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
						{mainServices.length > 0 && (
							<div className="space-y-3">
								{mainServices.map(renderServiceCard)}
							</div>
						)}
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
						const active = currentEntry.deliveryMethod === method
						const icon  = method === "cloud_link" ? "fa-cloud" : "fa-cloud-arrow-up"
						const title = method === "cloud_link" ? "Ho già caricato il materiale" : "Richiedi link di caricamento"
						const desc  = method === "cloud_link"
							? "Fornisci il link alla cartella cloud con tutti i file."
							: "Ti invieremo un link dove potrai caricare il materiale."
						return (
							<label
								key={method}
								htmlFor={`delivery-${method}-${selectedIdx}`}
								className={`flex items-start gap-3 p-4 rounded-lg border-2 cursor-pointer transition-all ${active ? "border-[#7c3aed] bg-[#f5f3ff]" : "border-gray-200 bg-white hover:border-[#ddd6fe] hover:bg-gray-50"}`}
							>
								<input
									id={`delivery-${method}-${selectedIdx}`}
									type="radio"
									name={`deliveryMethod-${selectedIdx}`}
									value={method}
									checked={active}
									onChange={() => updateCurrentEntry("deliveryMethod", method)}
									className="sr-only"
								/>
								<i className={`fa-solid ${icon} text-xl mt-0.5 shrink-0 ${active ? "text-[#7c3aed]" : "text-gray-400"}`} aria-hidden />
								<div>
									<p className={`font-medium ${active ? "text-[#6d28d9]" : "text-gray-900"}`}>{title}</p>
									<p className="text-sm text-gray-500 mt-0.5">{desc}</p>
								</div>
							</label>
						)
					})}
				</div>
				{currentEntry.deliveryMethod === "cloud_link" && (
					<Input
						name={`materialLink-${selectedIdx}`}
						type="url"
						label="Link cartella cloud *"
						value={currentEntry.materialLink}
						onChange={(e) => updateCurrentEntry("materialLink", e.target.value)}
						placeholder="Es. https://drive.google.com/drive/folders/..."
					/>
				)}
				<Input
					name={`materialSizeGb-${selectedIdx}`}
					type="number"
					label="Dimensione totale materiale (GB) *"
					value={currentEntry.materialSizeGb}
					onChange={(e) => updateCurrentEntry("materialSizeGb", e.target.value)}
					placeholder="Es. 25.5"
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
						const active = currentEntry.cameraCount === opt.value
						return (
							<label
								key={opt.value}
								htmlFor={`camera-${opt.value}-${selectedIdx}`}
								className={`flex flex-col items-center gap-2 p-4 rounded-lg border-2 cursor-pointer transition-all text-center ${active ? "border-[#7c3aed] bg-[#f5f3ff]" : "border-gray-200 bg-white hover:border-[#ddd6fe] hover:bg-gray-50"}`}
							>
								<input
									id={`camera-${opt.value}-${selectedIdx}`}
									type="radio"
									name={`cameraCount-${selectedIdx}`}
									value={opt.value}
									checked={active}
									onChange={() => updateCurrentEntry("cameraCount", opt.value)}
									className="sr-only"
								/>
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
					<Select colorScheme="brown" name={`exportFps-${selectedIdx}`}        label="Frame rate (FPS)"       value={currentEntry.exportFps}        onChange={(e) => updateCurrentEntry("exportFps", e.target.value as string | null)}        options={EXPORT_FPS_OPTIONS}        placeholder="Seleziona FPS"          />
					<Select colorScheme="brown" name={`exportBitrate-${selectedIdx}`}    label="Bitrate (Mbps)"         value={currentEntry.exportBitrate}    onChange={(e) => updateCurrentEntry("exportBitrate", e.target.value as string | null)}    options={EXPORT_BITRATE_OPTIONS}    placeholder="Seleziona bitrate"      />
					<Select colorScheme="brown" name={`exportAspect-${selectedIdx}`}     label="Formato (aspect ratio)" value={currentEntry.exportAspect}     onChange={(e) => updateCurrentEntry("exportAspect", e.target.value as string | null)}     options={EXPORT_ASPECT_OPTIONS}     placeholder="Seleziona formato"     />
					<Select colorScheme="brown" name={`exportResolution-${selectedIdx}`} label="Risoluzione"            value={currentEntry.exportResolution} onChange={(e) => updateCurrentEntry("exportResolution", e.target.value as string | null)} options={EXPORT_RESOLUTION_OPTIONS} placeholder="Seleziona risoluzione" />
				</div>
			</div>
		</>
	)

	// ─── Pannello riepilogo ───────────────────────────────────────────────────

	const renderSummaryPanel = (showOrderTotal: boolean) => (
		<div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
			<div className="bg-[#ede9fe] px-4 py-3 border-b border-[#ddd6fe]">
				<h2 className="text-lg font-semibold text-[#6d28d9]">Riepilogo</h2>
			</div>
			<div className="p-4 space-y-3">
				{/* In modalità multi: lista per matrimonio */}
				{isMulti && showOrderTotal ? (
					<>
						{entries.map((e, i) => {
							const tot = calcEntryTotal(e, services)
							return (
								<div
									key={i}
									className={`flex justify-between items-start text-sm gap-2 p-2 rounded-lg cursor-pointer transition ${i === selectedIdx ? "bg-[#f5f3ff]" : "hover:bg-gray-50"}`}
									onClick={() => setSelectedIdx(i)}
								>
									<div>
										<span className={`font-medium ${i === selectedIdx ? "text-[#6d28d9]" : "text-gray-700"}`}>
											{e.coupleName || `Matrimonio ${i + 1}`}
										</span>
										{e.weddingDate && (
											<span className="block text-xs text-gray-400">{formatDate(e.weddingDate)}</span>
										)}
									</div>
									<span className="font-semibold text-gray-900 shrink-0">€{tot.toFixed(2)}</span>
								</div>
							)
						})}
						<div className="border-t border-gray-200 pt-3 flex justify-between font-bold text-base">
							<span className="text-gray-800">Totale</span>
							<span className="text-[#7c3aed]">€{orderTotalPrice.toFixed(2)}</span>
						</div>
					</>
				) : (
					/* In modalità singola: dettaglio servizi (coppia/data vengono dai campi in cima) */
					<>

						{currentEntry.selectedServices.length > 0 ? (
							<>
								<div className="border-t border-gray-100 pt-3 space-y-2">
									{currentEntry.selectedServices.map((sel) => {
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
												Telecamere ({currentEntry.cameraCount})
												<span className="block text-xs text-gray-400">Supplemento multi-camera</span>
											</span>
											<span className="font-medium text-orange-600 shrink-0">+€{cameraSurcharge.toFixed(2)}</span>
										</div>
									)}
								</div>

								<div className="border-t border-gray-200 pt-3 flex justify-between font-semibold text-base">
									<span className="text-gray-800">Totale</span>
									<span className="text-[#7c3aed]">€{entryTotalPrice.toFixed(2)}</span>
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
					</>
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
	)

	// ─── Render ───────────────────────────────────────────────────────────────

	return (
		<div className="min-h-[calc(100vh-3.5rem)] relative">
			<form onSubmit={handleSubmit}>
				<div className="container mx-auto px-4 py-6 md:py-8 relative">

					{isMulti ? (
						/* ── Modalità multi: 3 pannelli ── */
						<div className="flex flex-col xl:flex-row gap-4 xl:gap-5">

							{/* Pannello sinistro: lista matrimoni */}
							<aside className="xl:w-80 shrink-0">
								<div className="xl:sticky xl:top-24 rounded-xl border border-gray-200 bg-white shadow-sm p-4 flex flex-col gap-3">
									<div>
										<h2 className="text-base font-bold text-gray-900">
											<i className="fa-solid fa-layer-group text-[#7c3aed] mr-2" />
											Matrimoni
										</h2>
										<p className="text-xs text-gray-400 mt-1 leading-relaxed">
											L'ordine con cui sono visualizzati i matrimoni definisce lo stesso ordine di priorità che avremo durante il montaggio.
										</p>
									</div>
									{entries.map((e, i) => {
										const tot = calcEntryTotal(e, services)
										const isActive = i === selectedIdx
										return (
											<div
												key={i}
												onClick={() => setSelectedIdx(i)}
												className={`relative p-3 rounded-lg border-2 cursor-pointer transition-all ${isActive ? "border-[#7c3aed] bg-[#f5f3ff]" : "border-gray-200 hover:border-gray-300"}`}
											>
												{/* Frecce riordino */}
												<div className="absolute top-2 right-2 flex flex-col gap-0.5">
													<button
														type="button"
														onClick={(ev) => { ev.stopPropagation(); moveEntry(i, "up") }}
														disabled={i === 0}
														className="w-5 h-5 flex items-center justify-center rounded text-gray-300 hover:text-[#7c3aed] hover:bg-[#ede9fe] disabled:opacity-20 disabled:cursor-not-allowed transition-colors cursor-pointer"
														title="Sposta su"
													>
														<i className="fa-solid fa-chevron-up text-[10px]" />
													</button>
													<button
														type="button"
														onClick={(ev) => { ev.stopPropagation(); moveEntry(i, "down") }}
														disabled={i === entries.length - 1}
														className="w-5 h-5 flex items-center justify-center rounded text-gray-300 hover:text-[#7c3aed] hover:bg-[#ede9fe] disabled:opacity-20 disabled:cursor-not-allowed transition-colors cursor-pointer"
														title="Sposta giù"
													>
														<i className="fa-solid fa-chevron-down text-[10px]" />
													</button>
												</div>

												<div className={`font-medium text-sm truncate pr-8 ${isActive ? "text-[#6d28d9]" : "text-gray-800"}`}>
													{e.coupleName || <span className="italic text-gray-400">Matrimonio {i + 1}</span>}
												</div>
												{e.weddingDate && (
													<div className="text-xs text-gray-400 mt-0.5 truncate">
														<i className="fa-solid fa-ring text-[8px] mr-1 text-[#c4b5fd]" />
														{formatDate(e.weddingDate)}
													</div>
												)}
												<div className={`text-sm font-bold mt-1 mb-2 ${isActive ? "text-[#7c3aed]" : "text-gray-600"}`}>
													€{tot.toFixed(2)}
												</div>

												{/* Azioni */}
												<div className="flex gap-2">
													<button
														type="button"
														onClick={(ev) => { ev.stopPropagation(); duplicateEntry(i) }}
														className="flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-md border border-[#c4b5fd] bg-white text-[#7c3aed] text-xs font-medium hover:bg-[#f5f3ff] transition-colors cursor-pointer"
													>
														<i className="fa-solid fa-copy text-[10px]" />
														Duplica
													</button>
													{entries.length > 1 && (
														<button
															type="button"
															onClick={(ev) => { ev.stopPropagation(); setConfirmDeleteIdx(i) }}
															className="flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-md border border-red-200 bg-white text-red-500 text-xs font-medium hover:bg-red-50 transition-colors cursor-pointer"
														>
															<i className="fa-solid fa-trash text-[10px]" />
															Elimina
														</button>
													)}
												</div>
											</div>
										)
									})}
									<button
										type="button"
										onClick={addEntry}
										className="w-full py-2 rounded-lg border border-dashed border-[#c4b5fd] text-[#7c3aed] text-sm font-medium hover:bg-[#f5f3ff] transition-colors cursor-pointer flex items-center justify-center gap-1"
									>
										<i className="fa-solid fa-plus text-xs" />
										Aggiungi matrimonio
									</button>
								</div>
							</aside>

							{/* Pannello centrale: config matrimonio selezionato */}
							<section className="flex-1 min-w-0 space-y-4">
								<div className="flex items-center gap-3 mb-2">
									<h1 className="text-xl font-bold text-[#6d28d9]">
										{currentEntry.coupleName || `Matrimonio ${selectedIdx + 1}`}
									</h1>
									<span className="text-sm text-gray-400">
										{selectedIdx + 1} / {entries.length}
									</span>
								</div>
								{renderEntryConfig()}

								{/* Note condivise — mostrate sotto il form */}
								<div className="rounded-xl border border-gray-200 bg-white shadow-sm p-6 md:p-8 space-y-4">
									<div>
										<h2 className="text-lg font-semibold text-gray-900">Note generali</h2>
										<p className="text-sm text-gray-400 mt-0.5">Comuni a tutti i matrimoni di questo ordine.</p>
									</div>
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
							</section>

							{/* Pannello destro: riepilogo */}
							<aside className="xl:w-72 shrink-0">
								<div className="xl:sticky xl:top-24">
									{renderSummaryPanel(true)}
								</div>
							</aside>
						</div>
					) : (
						/* ── Modalità singola: 2 colonne ── */
						<div className="flex flex-col lg:flex-row gap-8">

							{/* Colonna sinistra */}
							<section className="flex-1 max-w-4xl space-y-6">
								<h1 className="text-2xl font-bold text-[#6d28d9]">Nuovo progetto</h1>
								{renderEntryConfig(false)}

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

							</section>

							{/* Colonna destra: coppia/data + aggiungi matrimonio + riepilogo */}
							<aside className="lg:w-80 shrink-0">
								<div className="lg:sticky lg:top-24 space-y-4">
									{renderCoupleHeader()}
									<button
										type="button"
										onClick={() => duplicateEntry(0)}
										className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-dashed border-[#c4b5fd] text-[#7c3aed] font-medium hover:bg-[#f5f3ff] transition-colors cursor-pointer"
									>
										<i className="fa-solid fa-plus" />
										Aggiungi un altro matrimonio
									</button>
									{renderSummaryPanel(false)}
								</div>
							</aside>
						</div>
					)}

					<div className="absolute bottom-4 right-4 text-gray-200/30 text-5xl font-bold select-none pointer-events-none hidden md:block">
						WeddingCut
					</div>
				</div>

				{/* Modal conferma eliminazione */}
				{confirmDeleteIdx !== null && (
					<div className="fixed inset-0 z-50 flex items-center justify-center p-4">
						<div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setConfirmDeleteIdx(null)} />
						<div className="relative bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm">
							<div className="flex items-center gap-3 mb-4">
								<div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center shrink-0">
									<i className="fa-solid fa-trash text-red-500" />
								</div>
								<div>
									<p className="font-semibold text-gray-900 text-sm">Elimina matrimonio</p>
									<p className="text-xs text-gray-500 mt-0.5">
										{entries[confirmDeleteIdx]?.coupleName
											? `Stai per eliminare "${entries[confirmDeleteIdx].coupleName}".`
											: `Stai per eliminare il matrimonio ${confirmDeleteIdx + 1}.`}
									</p>
								</div>
							</div>
							<p className="text-sm text-gray-600 mb-5">Questa operazione non può essere annullata. Tutti i dati configurati per questo matrimonio andranno persi.</p>
							<div className="flex gap-3">
								<button
									type="button"
									onClick={() => setConfirmDeleteIdx(null)}
									className="flex-1 py-2 rounded-lg border border-gray-200 text-gray-700 text-sm font-medium hover:bg-gray-50 transition-colors cursor-pointer"
								>
									Annulla
								</button>
								<button
									type="button"
									onClick={() => removeEntry(confirmDeleteIdx)}
									className="flex-1 py-2 rounded-lg bg-red-500 text-white text-sm font-medium hover:bg-red-600 transition-colors cursor-pointer"
								>
									Elimina
								</button>
							</div>
						</div>
					</div>
				)}
			</form>
		</div>
	)
}

export default NewOrder
