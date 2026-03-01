import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { toast } from "react-toastify"
import Input from "../../Components/Input"
import Textarea from "../../Components/Textarea"
import Select from "../../Components/Select"
import DateTimePicker from "../../Components/DateTimePicker"
import { genericGet, genericPost } from "../../services/api-utility"

// ─── Tipi ────────────────────────────────────────────────────────────────────

interface PublicService {
	publicId: string
	name: string
	description: string
	orientation: "vertical" | "horizontal" | "both"
	priceVertical?: number
	priceHorizontal?: number
	priceBoth?: number
	durationDescription?: string
	minDuration?: number
	maxDuration?: number
}

interface SelectedService {
	publicId: string
	orientation: "vertical" | "horizontal" | "both"
	duration?: number
	notes?: string
}

type DeliveryMethod = "cloud_link" | "upload_request"
type CameraCount = "1-4" | "5-6" | "7+"

// ─── Costanti ─────────────────────────────────────────────────────────────────

const ORIENTATION_LABELS: Record<string, string> = {
	vertical: "Verticale",
	horizontal: "Orizzontale",
	both: "Entrambi",
}

const ORIENTATION_ICONS: Record<string, string> = {
	vertical: "fa-mobile-screen",
	horizontal: "fa-tv",
	both: "fa-layer-group",
}

const CAMERA_OPTIONS: { value: CameraCount; label: string; surcharge: number }[] = [
	{ value: "1-4", label: "1 – 4",  surcharge: 0   },
	{ value: "5-6", label: "5 – 6",  surcharge: 50  },
	{ value: "7+",  label: "7 +",    surcharge: 100 },
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

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getServicePrice(service: PublicService, orientation: "vertical" | "horizontal" | "both"): number | null {
	if (orientation === "vertical")   return service.priceVertical   ?? null
	if (orientation === "horizontal") return service.priceHorizontal ?? null
	return service.priceBoth ?? null
}

function getSavings(service: PublicService): number {
	if (service.priceVertical != null && service.priceHorizontal != null && service.priceBoth != null) {
		return service.priceVertical + service.priceHorizontal - service.priceBoth
	}
	return 0
}

// ─── Componente ───────────────────────────────────────────────────────────────

const NewOrder = () => {
	const navigate = useNavigate()

	// Progetto
	const [coupleNames,   setCoupleNames]   = useState("")
	const [weddingDate,   setWeddingDate]   = useState("")

	// Servizi
	const [services,         setServices]         = useState<PublicService[]>([])
	const [loadingServices,  setLoadingServices]  = useState(true)
	const [selectedServices, setSelectedServices] = useState<SelectedService[]>([])

	// Materiale
	const [deliveryMethod,  setDeliveryMethod]  = useState<DeliveryMethod | null>(null)
	const [materialLink,    setMaterialLink]    = useState("")
	const [materialSizeGb,  setMaterialSizeGb]  = useState("")

	// Note
	const [generalNotes,   setGeneralNotes]   = useState("")
	const [referenceVideo, setReferenceVideo] = useState("")

	// Telecamere
	const [cameraCount, setCameraCount] = useState<CameraCount | null>(null)

	// Esportazione
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

	// ─── Servizi: helpers ────────────────────────────────────────────────────

	const isSelected = (publicId: string) =>
		selectedServices.some((s) => s.publicId === publicId)

	const getSelectedOrientation = (publicId: string): "vertical" | "horizontal" | "both" | null =>
		selectedServices.find((s) => s.publicId === publicId)?.orientation ?? null

	const toggleService = (service: PublicService) => {
		if (isSelected(service.publicId)) {
			setSelectedServices((prev) => prev.filter((s) => s.publicId !== service.publicId))
		} else {
			const entry: SelectedService = { publicId: service.publicId, orientation: service.orientation }
			if (service.minDuration != null) entry.duration = service.minDuration
			setSelectedServices((prev) => [...prev, entry])
		}
	}

	const changeOrientation = (publicId: string, orientation: "vertical" | "horizontal" | "both") => {
		setSelectedServices((prev) =>
			prev.map((s) => (s.publicId === publicId ? { ...s, orientation } : s)),
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

	// ─── Prezzi ──────────────────────────────────────────────────────────────

	const servicesTotal = selectedServices.reduce((sum, sel) => {
		const service = services.find((s) => s.publicId === sel.publicId)
		if (!service) return sum
		return sum + (getServicePrice(service, sel.orientation) ?? 0)
	}, 0)

	const cameraSurcharge = CAMERA_OPTIONS.find((o) => o.value === cameraCount)?.surcharge ?? 0
	const totalPrice = servicesTotal + cameraSurcharge

	const hasUnpricedServices = selectedServices.some((sel) => {
		const service = services.find((s) => s.publicId === sel.publicId)
		return service ? getServicePrice(service, sel.orientation) === null : false
	})

	// ─── Submit ───────────────────────────────────────────────────────────────

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault()
		if (!coupleNames.trim())        { toast.error("Inserisci il nome della coppia");                        return }
		if (!weddingDate)               { toast.error("Inserisci la data del matrimonio");                      return }
		if (selectedServices.length === 0) { toast.error("Seleziona almeno un servizio");                      return }
		if (!deliveryMethod)            { toast.error("Seleziona come vuoi consegnare il materiale");           return }
		if (deliveryMethod === "cloud_link" && !materialLink.trim()) { toast.error("Inserisci il link al materiale"); return }
		if (!materialSizeGb.trim())     { toast.error("Inserisci la dimensione del materiale in GB");           return }
		if (!cameraCount)               { toast.error("Indica il numero di telecamere utilizzate");             return }

		setSubmitting(true)
		try {
			const payload = {
				coupleName: coupleNames.trim(),
				weddingDate,
				selectedServices,
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
				servicesTotal: hasUnpricedServices ? null : servicesTotal,
				cameraSurcharge,
				totalPrice: hasUnpricedServices ? null : totalPrice,
			}
			await genericPost("user/orders", payload)
			toast.success("Ordine inviato con successo!")
			navigate("/user/orders")
		} catch {
			toast.error("Errore durante l'invio dell'ordine")
		} finally {
			setSubmitting(false)
		}
	}

	// ─── Render ───────────────────────────────────────────────────────────────

	return (
		<div className="min-h-[calc(100vh-3.5rem)] bg-gray-100 relative">
			<form onSubmit={handleSubmit}>
				<div className="container mx-auto px-4 py-6 md:py-8 relative">
					<div className="flex flex-col lg:flex-row gap-8">

						{/* ── Colonna sinistra ── */}
						<section className="flex-1 max-w-4xl space-y-6">

							{/* Intestazione progetto */}
							<div className="rounded-xl border border-gray-200 bg-white shadow-sm p-6 md:p-8 space-y-6">
								<h1 className="text-2xl font-bold text-purple-800">Nuovo progetto</h1>
								<div className="grid grid-cols-1 sm:grid-cols-4 gap-4 items-end">
									<div className="sm:col-span-3">
										<Input
											name="coupleNames"
											type="text"
											label="Nomi della coppia"
											value={coupleNames}
											onChange={(e) => setCoupleNames(e.target.value)}
											placeholder="Ad es. «Mario e Laura». Sarà il nome del progetto."
										/>
									</div>
									<div className="sm:col-span-1">
										<DateTimePicker
											label="Data del matrimonio"
											value={weddingDate || null}
											onChange={(date) => setWeddingDate(date ?? "")}
										/>
									</div>
								</div>
							</div>

							{/* Selezione servizi */}
							<div className="rounded-xl border border-gray-200 bg-white shadow-sm p-6 md:p-8 space-y-4">
								<div>
									<h2 className="text-lg font-semibold text-gray-900">Servizi</h2>
									<p className="text-sm text-gray-500 mt-0.5">Seleziona i servizi da includere nel progetto.</p>
								</div>

								{loadingServices ? (
									<div className="flex items-center gap-3 py-8 text-gray-500">
										<i className="fa-solid fa-spinner fa-spin text-purple-600" />
										<span>Caricamento servizi in corso…</span>
									</div>
								) : services.length === 0 ? (
									<p className="py-8 text-center text-gray-400 text-sm">Nessun servizio disponibile al momento.</p>
								) : (
									<div className="space-y-3">
										{services.map((service) => {
											const selected = isSelected(service.publicId)
											const selectedOrientation = getSelectedOrientation(service.publicId)
											const savings = getSavings(service)
											const sel = selectedServices.find(s => s.publicId === service.publicId)

											return (
												<div
													key={service.publicId}
													className={`rounded-xl border-2 p-4 transition-colors ${
														selected ? "border-purple-500 bg-purple-50" : "border-gray-200 bg-white"
													}`}
												>
													<div className="flex items-start gap-3">
														<input
															id={`check-${service.publicId}`}
															type="checkbox"
															checked={selected}
															onChange={() => toggleService(service)}
															className="mt-1 rounded border-gray-300 text-purple-600 focus:ring-purple-500 cursor-pointer"
														/>
														<label htmlFor={`check-${service.publicId}`} className="flex-1 min-w-0 cursor-pointer">
															<div className="flex flex-wrap items-center gap-2">
																<span className="font-semibold text-gray-900">{service.name}</span>
																{service.durationDescription && (
																	<span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
																		{service.durationDescription}
																	</span>
																)}
																{service.orientation !== "both" && (
																	<span className="inline-flex items-center gap-1 text-xs font-medium text-purple-700 bg-purple-100 px-2 py-0.5 rounded-full">
																		<i className={`fa-solid ${ORIENTATION_ICONS[service.orientation]} text-[10px]`} aria-hidden />
																		{ORIENTATION_LABELS[service.orientation]}
																	</span>
																)}
															</div>
															<p className="text-sm text-gray-500 mt-0.5">{service.description}</p>
															{service.orientation !== "both" && (
																<p className="mt-1.5 text-sm font-semibold text-gray-800">
																	{getServicePrice(service, service.orientation) != null
																		? `€${getServicePrice(service, service.orientation)!.toFixed(2)}`
																		: <span className="font-normal text-gray-400 italic">Preventivo su richiesta</span>
																	}
																</p>
															)}
															{service.orientation === "both" && !selected && (
																<p className="mt-1.5 text-sm text-gray-500">
																	A partire da{" "}
																	<span className="font-semibold text-gray-800">
																		€{Math.min(
																			...[service.priceVertical, service.priceHorizontal, service.priceBoth]
																				.filter((p): p is number => p != null)
																		).toFixed(2)}
																	</span>
																</p>
															)}
														</label>
													</div>

													{selected && (
														<div className="mt-4 ml-7 space-y-4">
															{/* Slider durata */}
															{service.minDuration != null && service.maxDuration != null && (
																<div className="space-y-1.5">
																	<div className="flex items-center justify-between">
																		<p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Durata</p>
																		<span className="text-sm font-semibold text-purple-700">
																			{sel?.duration ?? service.minDuration} min
																		</span>
																	</div>
																	<input
																		type="range"
																		min={service.minDuration}
																		max={service.maxDuration}
																		step={1}
																		value={sel?.duration ?? service.minDuration}
																		onChange={(e) => changeDuration(service.publicId, Number(e.target.value))}
																		className="w-full h-2 rounded-lg appearance-none cursor-pointer accent-purple-600 bg-gray-200"
																	/>
																	<div className="flex justify-between text-xs text-gray-400">
																		<span>{service.minDuration} min</span>
																		<span>{service.maxDuration} min</span>
																	</div>
																</div>
															)}

															{/* Orientamento (radio) */}
															{service.orientation === "both" && (
																<div className="space-y-2">
																	<p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Orientamento</p>
																	<div className="grid grid-cols-3 gap-2">
																		{(["vertical", "horizontal", "both"] as const).map((o) => {
																			const price = getServicePrice(service, o)
																			const active = selectedOrientation === o
																			const optionHasSavings = o === "both" && savings > 0
																			const radioId = `orientation-${service.publicId}-${o}`
																			return (
																				<div key={o} className="relative">
																					{optionHasSavings && (
																						<span className={`absolute -top-2.5 left-1/2 -translate-x-1/2 z-10 text-[10px] font-bold px-1.5 py-0.5 rounded-full whitespace-nowrap ${active ? "bg-purple-700 text-white" : "bg-purple-600 text-white"}`}>
																							Risparmio €{savings % 1 === 0 ? savings : savings.toFixed(2)}
																						</span>
																					)}
																					<label
																						htmlFor={radioId}
																						className={`flex flex-col items-center gap-1 px-2 py-3 rounded-lg border-2 transition-all cursor-pointer text-center ${active ? "border-purple-500 bg-purple-50" : "border-gray-200 bg-white hover:border-purple-300 hover:bg-purple-50"}`}
																					>
																						<input id={radioId} type="radio" name={`orientation-${service.publicId}`} value={o} checked={active} onChange={() => changeOrientation(service.publicId, o)} className="sr-only" />
																						<i className={`fa-solid ${ORIENTATION_ICONS[o]} text-base ${active ? "text-purple-600" : "text-gray-400"}`} aria-hidden />
																						<span className={`text-xs font-medium ${active ? "text-purple-700" : "text-gray-600"}`}>{ORIENTATION_LABELS[o]}</span>
																						<span className={`text-sm font-bold ${active ? "text-purple-800" : "text-gray-900"}`}>
																							{price != null ? `€${price.toFixed(2)}` : <span className="text-xs font-normal italic text-gray-400">Su richiesta</span>}
																						</span>
																					</label>
																				</div>
																			)
																		})}
																	</div>
																</div>
															)}

															{/* Specifiche aggiuntive */}
															<Textarea
																name={`notes-${service.publicId}`}
																label="Specifiche aggiuntive"
																rows={3}
																value={sel?.notes ?? ""}
																onChange={(e) => changeNotes(service.publicId, e.target.value)}
																placeholder="Inserisci eventuali richieste o dettagli specifici per questo servizio…"
															/>
														</div>
													)}
												</div>
											)
										})}
									</div>
								)}
							</div>

							{/* ── Materiale ── */}
							<div className="rounded-xl border border-gray-200 bg-white shadow-sm p-6 md:p-8 space-y-4">
								<div>
									<h2 className="text-lg font-semibold text-gray-900">Materiale</h2>
									<p className="text-sm text-gray-500 mt-0.5">Indica come vuoi consegnarci il materiale video.</p>
								</div>

								<div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
									{(["cloud_link", "upload_request"] as const).map((method) => {
										const active = deliveryMethod === method
										const icon  = method === "cloud_link" ? "fa-cloud" : "fa-cloud-arrow-up"
										const title = method === "cloud_link"
											? "Ho già caricato il materiale"
											: "Richiedi link di caricamento"
										const desc  = method === "cloud_link"
											? "Fornisci il link alla cartella cloud con tutti i file."
											: "Ti invieremo un link dove potrai caricare il materiale."
										return (
											<label
												key={method}
												htmlFor={`delivery-${method}`}
												className={`flex items-start gap-3 p-4 rounded-lg border-2 cursor-pointer transition-all ${active ? "border-purple-500 bg-purple-50" : "border-gray-200 bg-white hover:border-purple-200 hover:bg-gray-50"}`}
											>
												<input id={`delivery-${method}`} type="radio" name="deliveryMethod" value={method} checked={active} onChange={() => setDeliveryMethod(method)} className="sr-only" />
												<i className={`fa-solid ${icon} text-xl mt-0.5 shrink-0 ${active ? "text-purple-600" : "text-gray-400"}`} aria-hidden />
												<div>
													<p className={`font-medium ${active ? "text-purple-800" : "text-gray-900"}`}>{title}</p>
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

							{/* ── Note ── */}
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
									placeholder="Link o descrizione di video che vorresti usare come riferimento stilistico per il montaggio."
								/>
							</div>

							{/* ── Telecamere ── */}
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
												className={`flex flex-col items-center gap-2 p-4 rounded-lg border-2 cursor-pointer transition-all text-center ${active ? "border-purple-500 bg-purple-50" : "border-gray-200 bg-white hover:border-purple-200 hover:bg-gray-50"}`}
											>
												<input id={`camera-${opt.value}`} type="radio" name="cameraCount" value={opt.value} checked={active} onChange={() => setCameraCount(opt.value)} className="sr-only" />
												<i className={`fa-solid fa-video text-2xl ${active ? "text-purple-600" : "text-gray-400"}`} aria-hidden />
												<span className={`font-semibold text-lg ${active ? "text-purple-800" : "text-gray-900"}`}>{opt.label}</span>
												{opt.surcharge > 0
													? <span className={`text-xs font-medium ${active ? "text-purple-600" : "text-orange-500"}`}>+€{opt.surcharge}</span>
													: <span className="text-xs text-gray-400">Incluso</span>
												}
											</label>
										)
									})}
								</div>
							</div>

							{/* ── Impostazioni di esportazione ── */}
							<div className="rounded-xl border border-gray-200 bg-white shadow-sm p-6 md:p-8 space-y-4">
								<div>
									<h2 className="text-lg font-semibold text-gray-900">Impostazioni di esportazione</h2>
									<p className="text-sm text-gray-500 mt-0.5">Specifica il formato tecnico desiderato per i file finali. Se non hai preferenze puoi lasciare i campi vuoti.</p>
								</div>
								<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
									<Select
										name="exportFps"
										label="Frame rate (FPS)"
										value={exportFps}
										onChange={(e) => setExportFps(e.target.value as string | null)}
										options={EXPORT_FPS_OPTIONS}
										placeholder="Seleziona FPS"
									/>
									<Select
										name="exportBitrate"
										label="Bitrate (Mbps)"
										value={exportBitrate}
										onChange={(e) => setExportBitrate(e.target.value as string | null)}
										options={EXPORT_BITRATE_OPTIONS}
										placeholder="Seleziona bitrate"
									/>
									<Select
										name="exportAspect"
										label="Formato (aspect ratio)"
										value={exportAspect}
										onChange={(e) => setExportAspect(e.target.value as string | null)}
										options={EXPORT_ASPECT_OPTIONS}
										placeholder="Seleziona formato"
									/>
									<Select
										name="exportResolution"
										label="Risoluzione"
										value={exportResolution}
										onChange={(e) => setExportResolution(e.target.value as string | null)}
										options={EXPORT_RESOLUTION_OPTIONS}
										placeholder="Seleziona risoluzione"
									/>
								</div>
							</div>

						</section>

						{/* ── Colonna destra: riepilogo ── */}
						<aside className="lg:w-80 shrink-0">
							<div className="lg:sticky lg:top-24 rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
								<div className="bg-purple-100 px-4 py-3 border-b border-purple-200">
									<h2 className="text-lg font-semibold text-purple-800">Riepilogo</h2>
								</div>
								<div className="p-4 space-y-3">
									{coupleNames && (
										<div className="text-sm text-gray-700">
											<span className="font-medium">Coppia:</span> {coupleNames}
										</div>
									)}
									{weddingDate && (
										<div className="text-sm text-gray-700">
											<span className="font-medium">Data:</span> {weddingDate}
										</div>
									)}

									{selectedServices.length > 0 ? (
										<>
											<div className="border-t border-gray-100 pt-3 space-y-2">
												{selectedServices.map((sel) => {
													const service = services.find((s) => s.publicId === sel.publicId)
													if (!service) return null
													const price = getServicePrice(service, sel.orientation)
													return (
														<div key={sel.publicId} className="flex justify-between items-start text-sm gap-2">
															<span className="text-gray-700 leading-snug">
																{service.name}
																<span className="block text-xs text-gray-400">
																	{ORIENTATION_LABELS[sel.orientation]}
																	{sel.duration != null && ` · ${sel.duration} min`}
																</span>
															</span>
															<span className="font-medium text-gray-900 shrink-0">
																{price != null ? `€${price.toFixed(2)}` : <em className="text-gray-400 font-normal">Su richiesta</em>}
															</span>
														</div>
													)
												})}

												{/* Supplemento telecamere */}
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
												<span className="text-purple-700">€{totalPrice.toFixed(2)}</span>
											</div>

											{hasUnpricedServices && (
												<p className="text-xs text-gray-500">
													* I servizi "Su richiesta" non sono inclusi nel totale.
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
										className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-purple-700 text-white font-medium hover:bg-purple-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer"
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
