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

interface ServiceOption {
	publicId: string
	name: string
	price: number
	discountRole?: string | null
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
	discountRole?: string | null
	options?: ServiceOption[] | null
}

interface DiscountQuantityTier {
	minUnits: number
	maxUnits: number | null
	discountPct: number
}

interface DiscountRule {
	targetRole?: string       // es. "teaser"
	targetCategory?: string   // es. "extra"
	type: "new_price" | "pct_off"
	value: number
}

interface DiscountPackageRule {
	name: string
	requiredRoles: string[]
	requiredRolesAnyOf: string[] | null  // almeno uno di questi (OR)
	discounts: DiscountRule[]            // regole di sconto per-ruolo / per-categoria
	unitCountIfApplied: number | null    // unità da contare per questo pacchetto
	isBonus: number
}

interface PackageDiscountResult {
	mainPackage: DiscountPackageRule | null
	bonusApplied: boolean
	priceOverrides: Map<string, number>  // publicId → prezzo effettivo
	totalAmt: number
}

interface DiscountConfig {
	quantityTiers: DiscountQuantityTier[]
	packages: DiscountPackageRule[]
}

interface SelectedService {
	publicId: string
	tierLabel?: string | null
	duration?: number | null
	notes?: string
	selectedOptions?: string[]   // publicId delle opzioni selezionate
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
	generalNotes: string
	referenceVideo: string
}

// ─── Costanti ─────────────────────────────────────────────────────────────────

// Ruoli che contano come "unità" per lo sconto quantità
const UNIT_ROLES = new Set(["teaser", "highlight", "weddingfilm"])

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
	generalNotes: "", referenceVideo: "",
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

function calcEntryMainSubtotal(
	entry: EntryForm,
	services: PublicService[],
	overrides: Map<string, number> = new Map(),
): number {
	return entry.selectedServices.reduce((sum, sel) => {
		const svc = services.find((s) => s.publicId === sel.publicId)
		if (!svc || svc.category === "delivery") return sum
		const price = overrides.has(sel.publicId) ? overrides.get(sel.publicId)! : (getSelectedPrice(svc, sel) ?? 0)
		const optionsTotal = (sel.selectedOptions ?? []).reduce((oSum, optId) => {
			const opt = svc.options?.find((o) => o.publicId === optId)
			if (!opt) return oSum
			return oSum + (overrides.has(optId) ? overrides.get(optId)! : opt.price)
		}, 0)
		return sum + price + optionsTotal
	}, 0)
}

function calcEntryFastDelivery(entry: EntryForm, services: PublicService[], mainSubtotal: number): number {
	const deliverySvc = services.find(
		(s) => s.category === "delivery" && entry.selectedServices.some((sel) => sel.publicId === s.publicId),
	)
	if (deliverySvc?.percentageValue == null) return 0
	return Math.round(mainSubtotal * (Number(deliverySvc.percentageValue) / 100) * 100) / 100
}

// Trova il pacchetto principale (non bonus) più specifico applicabile all'entry
function bestPackageForEntry(
	entry: EntryForm,
	services: PublicService[],
	packages: DiscountPackageRule[],
): DiscountPackageRule | null {
	const entryRoles = new Set<string>()
	for (const sel of entry.selectedServices) {
		const svc = services.find((s) => s.publicId === sel.publicId)
		if (!svc) continue
		if (svc.discountRole) entryRoles.add(svc.discountRole)
		// Aggiunge i ruoli delle opzioni selezionate
		for (const optId of (sel.selectedOptions ?? [])) {
			const opt = svc.options?.find((o) => o.publicId === optId)
			if (opt?.discountRole) entryRoles.add(opt.discountRole)
		}
	}
	const applicable = packages
		.filter((p) => !p.isBonus)
		.filter((p) => {
			const andOk = p.requiredRoles.every((r) => entryRoles.has(r))
			const anyOfOk = !p.requiredRolesAnyOf?.length || p.requiredRolesAnyOf.some((r) => entryRoles.has(r))
			return andOk && anyOfOk
		})
	if (!applicable.length) return null
	// Più specifico = più ruoli richiesti totali
	return applicable.sort((a, b) => {
		const scoreA = a.requiredRoles.length + (a.requiredRolesAnyOf?.length ? 1 : 0)
		const scoreB = b.requiredRoles.length + (b.requiredRolesAnyOf?.length ? 1 : 0)
		return scoreB - scoreA
	})[0]
}

// Costruisce la mappa publicId → prezzo effettivo in base alle regole di sconto
function buildPriceOverrides(
	entry: EntryForm,
	services: PublicService[],
	rules: DiscountRule[],
): Map<string, number> {
	const overrides = new Map<string, number>()
	for (const rule of rules) {
		for (const sel of entry.selectedServices) {
			const svc = services.find((s) => s.publicId === sel.publicId)
			if (!svc) continue
			// Sconto sul servizio principale
			const matchesRole     = !!rule.targetRole     && svc.discountRole === rule.targetRole
			const matchesCategory = !!rule.targetCategory && svc.category     === rule.targetCategory
			if (matchesRole || matchesCategory) {
				const originalPrice = getSelectedPrice(svc, sel) ?? 0
				const newPrice = rule.type === "new_price"
					? rule.value
					: Math.round(originalPrice * (1 - rule.value / 100) * 100) / 100
				const existing = overrides.get(sel.publicId)
				if (existing === undefined || newPrice < existing) overrides.set(sel.publicId, newPrice)
			}
			// Sconto sulle opzioni (solo per targetRole, le opzioni non hanno categoria)
			if (rule.targetRole) {
				for (const optId of (sel.selectedOptions ?? [])) {
					const opt = svc.options?.find((o) => o.publicId === optId)
					if (!opt || opt.discountRole !== rule.targetRole) continue
					const newPrice = rule.type === "new_price"
						? rule.value
						: Math.round(opt.price * (1 - rule.value / 100) * 100) / 100
					const existing = overrides.get(optId)
					if (existing === undefined || newPrice < existing) overrides.set(optId, newPrice)
				}
			}
		}
	}
	return overrides
}

function calcPackageDiscount(
	entry: EntryForm,
	services: PublicService[],
	packages: DiscountPackageRule[],
): PackageDiscountResult {
	const mainPackage = bestPackageForEntry(entry, services, packages)
	if (!mainPackage) {
		return { mainPackage: null, bonusApplied: false, priceOverrides: new Map(), totalAmt: 0 }
	}
	const allRules = [...mainPackage.discounts]
	const bonusPkg = packages.find((p) => p.isBonus === 1)
	const bonusApplied = !!bonusPkg
	if (bonusPkg) allRules.push(...bonusPkg.discounts)
	const priceOverrides = buildPriceOverrides(entry, services, allRules)
	// Calcola l'importo totale risparmiato (servizi + opzioni)
	let totalAmt = 0
	for (const [publicId, newPrice] of priceOverrides) {
		// Controlla se è un servizio
		const sel = entry.selectedServices.find((s) => s.publicId === publicId)
		const svc = services.find((s) => s.publicId === publicId)
		if (sel && svc) {
			totalAmt += (getSelectedPrice(svc, sel) ?? 0) - newPrice
			continue
		}
		// Controlla se è un'opzione
		for (const s of entry.selectedServices) {
			const parentSvc = services.find((sv) => sv.publicId === s.publicId)
			const opt = parentSvc?.options?.find((o) => o.publicId === publicId)
			if (opt) { totalAmt += opt.price - newPrice; break }
		}
	}
	totalAmt = Math.round(totalAmt * 100) / 100
	return { mainPackage, bonusApplied, priceOverrides, totalAmt }
}

function countEntryUnits(
	entry: EntryForm,
	services: PublicService[],
	packages: DiscountPackageRule[],
): number {
	const unitSels = entry.selectedServices.filter((sel) => {
		const svc = services.find((s) => s.publicId === sel.publicId)
		return svc?.discountRole != null && UNIT_ROLES.has(svc.discountRole)
	})
	if (!unitSels.length) return 0
	const appliedPkg = bestPackageForEntry(entry, services, packages)
	if (appliedPkg?.unitCountIfApplied != null) return appliedPkg.unitCountIfApplied
	return unitSels.length
}

function calcQuantityDiscount(
	entries: EntryForm[],
	services: PublicService[],
	tiers: DiscountQuantityTier[],
	packages: DiscountPackageRule[],
	orderSubtotal: number,
): { pct: number; amt: number; unitCount: number } {
	const unitCount = entries.reduce((sum, e) => sum + countEntryUnits(e, services, packages), 0)
	const tier = [...tiers]
		.sort((a, b) => b.minUnits - a.minUnits)
		.find((t) => unitCount >= t.minUnits)
	const pct = tier?.discountPct ?? 0
	const amt = Math.round(orderSubtotal * (pct / 100) * 100) / 100
	return { pct, amt, unitCount }
}

function calcEntryTotal(
	entry: EntryForm,
	services: PublicService[],
	packages: DiscountPackageRule[] = [],
): number {
	const pkgDisc = calcPackageDiscount(entry, services, packages)
	const main = calcEntryMainSubtotal(entry, services, pkgDisc.priceOverrides)
	const fd   = calcEntryFastDelivery(entry, services, main)
	const cs   = CAMERA_OPTIONS.find((o) => o.value === entry.cameraCount)?.surcharge ?? 0
	return main + fd + cs
}

function buildServicesPayload(
	entry: EntryForm,
	services: PublicService[],
	overrides: Map<string, number> = new Map(),
) {
	const main = calcEntryMainSubtotal(entry, services, overrides)
	const fd   = calcEntryFastDelivery(entry, services, main)
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
			item.duration  = sel.duration ?? null
			const origPrice = svc.priceTiers?.find((t) => t.label === sel.tierLabel)?.price ?? 0
			item.price = overrides.get(sel.publicId) ?? origPrice
		} else if (svc.pricingType === "fixed") {
			item.price = overrides.get(sel.publicId) ?? (svc.basePrice ?? 0)
		} else if (svc.pricingType === "percentage") {
			item.percentageValue = svc.percentageValue
			item.price = fd
		}
		if ((sel.selectedOptions ?? []).length > 0) {
			item.options = (sel.selectedOptions ?? []).map((optId) => {
				const opt = svc.options?.find((o) => o.publicId === optId)!
				return {
					publicId: optId,
					name: opt.name,
					price: overrides.get(optId) ?? opt.price,
					discountRole: opt.discountRole ?? undefined,
				}
			})
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

	const [services,        setServices]        = useState<PublicService[]>([])
	const [loadingServices, setLoadingServices] = useState(true)
	const [submitting,      setSubmitting]      = useState(false)
	const [confirmDeleteIdx, setConfirmDeleteIdx] = useState<number | null>(null)
	const [discountConfig,  setDiscountConfig]  = useState<DiscountConfig>({ quantityTiers: [], packages: [] })
	const [showDiscountInfo, setShowDiscountInfo] = useState(false)

	// Stato modale duplica
	const [duplicateFromIdx,       setDuplicateFromIdx]       = useState<number | null>(null)
	const [duplicateCoupleName,    setDuplicateCoupleName]    = useState("")
	const [duplicateWeddingDate,   setDuplicateWeddingDate]   = useState("")

	useEffect(() => {
		Promise.all([
			genericGet("user/services"),
			genericGet("user/discount-config"),
		])
			.then(([svcs, dc]: [PublicService[], DiscountConfig]) => {
				setServices(svcs)
				setDiscountConfig(dc)
			})
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
		setDuplicateFromIdx(idx)
		setDuplicateCoupleName("")
		setDuplicateWeddingDate("")
	}

	const confirmDuplicate = () => {
		if (duplicateFromIdx === null) return
		const source = entries[duplicateFromIdx]
		const copy: EntryForm = {
			...JSON.parse(JSON.stringify(source)),
			coupleName:    duplicateCoupleName.trim(),
			weddingDate:   duplicateWeddingDate,
			generalNotes:  "",
			referenceVideo: "",
		}
		setEntries((prev) => [...prev, copy])
		setSelectedIdx(entries.length)
		setIsMulti(true)
		setDuplicateFromIdx(null)
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

	const toggleOption = (servicePublicId: string, optionPublicId: string) => {
		updateCurrentEntry(
			"selectedServices",
			currentEntry.selectedServices.map((s) => {
				if (s.publicId !== servicePublicId) return s
				const current = s.selectedOptions ?? []
				const next = current.includes(optionPublicId)
					? current.filter((id) => id !== optionPublicId)
					: [...current, optionPublicId]
				return { ...s, selectedOptions: next }
			}),
		)
	}

	// ─── Visibilità extras ────────────────────────────────────────────────────

	const selectedPublicIds = new Set(currentEntry.selectedServices.map((s) => s.publicId))

	const isExtraVisible = (service: PublicService): boolean => {
		if (!service.restrictedToService) return true
		return selectedPublicIds.has(service.restrictedToService)
	}

	// ─── Calcolo prezzi entry corrente ────────────────────────────────────────

	const pkgDiscResult      = calcPackageDiscount(currentEntry, services, discountConfig.packages)
	const mainExtraSubtotal  = calcEntryMainSubtotal(currentEntry, services, pkgDiscResult.priceOverrides)
	const fastDeliveryAmount = calcEntryFastDelivery(currentEntry, services, mainExtraSubtotal)
	const entryServicesTotal = mainExtraSubtotal + fastDeliveryAmount
	const cameraSurcharge    = CAMERA_OPTIONS.find((o) => o.value === currentEntry.cameraCount)?.surcharge ?? 0
	const entryTotalPrice    = entryServicesTotal + cameraSurcharge

	// Totale ordine (somma di tutte le entries dopo sconti pacchetto) e sconto quantità
	const orderSubtotalBeforeQty = entries.reduce(
		(sum, e) => sum + calcEntryTotal(e, services, discountConfig.packages),
		0,
	)
	const quantityDiscount = calcQuantityDiscount(
		entries,
		services,
		discountConfig.quantityTiers,
		discountConfig.packages,
		orderSubtotalBeforeQty,
	)
	const orderTotalPrice = orderSubtotalBeforeQty - quantityDiscount.amt

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
				const pkgDisc = calcPackageDiscount(entry, services, discountConfig.packages)
				const main    = calcEntryMainSubtotal(entry, services, pkgDisc.priceOverrides)
				const fd      = calcEntryFastDelivery(entry, services, main)
				const cs      = CAMERA_OPTIONS.find((o) => o.value === entry.cameraCount)?.surcharge ?? 0
				return {
					coupleName:         entry.coupleName.trim(),
					weddingDate:        entry.weddingDate,
					selectedServices:   buildServicesPayload(entry, services, pkgDisc.priceOverrides),
					deliveryMethod:     entry.deliveryMethod,
					materialLink:       entry.deliveryMethod === "cloud_link" ? entry.materialLink.trim() : null,
					materialSizeGb:     Number(entry.materialSizeGb),
					cameraCount:        entry.cameraCount,
					exportFps:          entry.exportFps,
					exportBitrate:      entry.exportBitrate,
					exportAspect:       entry.exportAspect,
					exportResolution:   entry.exportResolution,
					servicesTotal:      main + fd,
					cameraSurcharge:    cs,
					packageDiscountPct: pkgDisc.totalAmt > 0 ? null : null,  // snapshot non più % flat
					packageDiscountAmt: pkgDisc.totalAmt > 0 ? pkgDisc.totalAmt : null,
					totalPrice:         main + fd + cs,
					generalNotes:       entry.generalNotes.trim() || null,
					referenceVideo:     entry.referenceVideo.trim() || null,
				}
			})

			const first = entriesPayload[0]
			const payload: Record<string, any> = {
				// Prima entry come retrocompat ordine padre
				coupleName:          first.coupleName,
				weddingDate:         first.weddingDate,
				deliveryMethod:      first.deliveryMethod,
				materialLink:        first.materialLink,
				materialSizeGb:      first.materialSizeGb,
				cameraCount:         first.cameraCount,
				exportFps:           first.exportFps,
				exportBitrate:       first.exportBitrate,
				exportAspect:        first.exportAspect,
				exportResolution:    first.exportResolution,
				selectedServices:    first.selectedServices,
				servicesTotal:       first.servicesTotal,
				cameraSurcharge:     first.cameraSurcharge,
				totalPrice:          orderTotalPrice,
				quantityDiscountPct: quantityDiscount.pct || null,
				quantityDiscountAmt: quantityDiscount.amt || null,
				quantityUnitCount:   quantityDiscount.unitCount || null,
				isBatch:             isMulti ? 1 : 0,
				isDraft:             false,
				entries:             entriesPayload,
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

	// ─── Salva bozza ─────────────────────────────────────────────────────────

	const handleSaveDraft = async () => {
		setSubmitting(true)
		try {
			const entriesPayload = entries.map((entry) => {
				const pkgDisc = calcPackageDiscount(entry, services, discountConfig.packages)
				const main    = calcEntryMainSubtotal(entry, services, pkgDisc.priceOverrides)
				const fd      = calcEntryFastDelivery(entry, services, main)
				const cs      = CAMERA_OPTIONS.find((o) => o.value === entry.cameraCount)?.surcharge ?? 0
				return {
					coupleName:         entry.coupleName.trim() || null,
					weddingDate:        entry.weddingDate || null,
					selectedServices:   buildServicesPayload(entry, services, pkgDisc.priceOverrides),
					deliveryMethod:     entry.deliveryMethod,
					materialLink:       entry.deliveryMethod === "cloud_link" ? entry.materialLink.trim() : null,
					materialSizeGb:     entry.materialSizeGb ? Number(entry.materialSizeGb) : null,
					cameraCount:        entry.cameraCount,
					exportFps:          entry.exportFps,
					exportBitrate:      entry.exportBitrate,
					exportAspect:       entry.exportAspect,
					exportResolution:   entry.exportResolution,
					servicesTotal:      main + fd,
					cameraSurcharge:    cs,
					packageDiscountPct: null,
					packageDiscountAmt: pkgDisc.totalAmt > 0 ? pkgDisc.totalAmt : null,
					totalPrice:         main + fd + cs,
					generalNotes:       entry.generalNotes.trim() || null,
					referenceVideo:     entry.referenceVideo.trim() || null,
				}
			})
			const first = entriesPayload[0]
			const payload: Record<string, any> = {
				coupleName:          first.coupleName,
				weddingDate:         first.weddingDate,
				deliveryMethod:      first.deliveryMethod,
				materialLink:        first.materialLink,
				materialSizeGb:      first.materialSizeGb,
				cameraCount:         first.cameraCount,
				exportFps:           first.exportFps,
				exportBitrate:       first.exportBitrate,
				exportAspect:        first.exportAspect,
				exportResolution:    first.exportResolution,
				selectedServices:    first.selectedServices,
				servicesTotal:       first.servicesTotal,
				cameraSurcharge:     first.cameraSurcharge,
				totalPrice:          orderTotalPrice,
				quantityDiscountPct: quantityDiscount.pct || null,
				quantityDiscountAmt: quantityDiscount.amt || null,
				quantityUnitCount:   quantityDiscount.unitCount || null,
				isBatch:             isMulti ? 1 : 0,
				isDraft:             true,
				entries:             entriesPayload,
			}
			const result = await genericPost("user/orders", payload)
			toast.success("Bozza salvata!")
			navigate(`/user/orders/${result.publicId}`)
		} catch {
			toast.error("Errore durante il salvataggio della bozza")
		} finally {
			setSubmitting(false)
		}
	}

	// ─── Flag: dati base inseriti (nome + data) ─────────────────────────────
	const hasEnteredBasicInfo = entries[0].coupleName.trim() !== "" && entries[0].weddingDate !== ""

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

						{/* Opzioni del servizio */}
						{(service.options ?? []).length > 0 && (
							<div className="space-y-2">
								<p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Opzioni</p>
								{(service.options ?? []).map((opt) => {
									const isOptSelected = sel?.selectedOptions?.includes(opt.publicId) ?? false
									const optOverridePrice = pkgDiscResult.priceOverrides.get(opt.publicId)
									const displayPrice = optOverridePrice !== undefined ? optOverridePrice : opt.price
									const isDiscounted = optOverridePrice !== undefined && optOverridePrice !== opt.price
									return (
										<label
											key={opt.publicId}
											className={`flex items-center gap-3 p-2 rounded-lg border cursor-pointer transition-colors ${
												isOptSelected ? "border-[#c4b5fd] bg-[#faf5ff]" : "border-gray-200 bg-white hover:border-gray-300"
											}`}
										>
											<input
												type="checkbox"
												checked={isOptSelected}
												onChange={() => toggleOption(service.publicId, opt.publicId)}
												className="rounded border-gray-300 text-[#7c3aed] focus:ring-[#7c3aed] cursor-pointer"
											/>
											<span className="flex-1 text-sm text-gray-700">{opt.name}</span>
											<span className="text-sm font-semibold shrink-0">
												{isDiscounted ? (
													<>
														<span className="line-through text-gray-400 text-xs mr-1">+€{opt.price.toFixed(2)}</span>
														<span className="text-green-700">+€{displayPrice.toFixed(2)}</span>
													</>
												) : (
													<span className="text-gray-900">+€{opt.price.toFixed(2)}</span>
												)}
											</span>
										</label>
									)
								})}
							</div>
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
							const tot = calcEntryTotal(e, services, discountConfig.packages)
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
						{quantityDiscount.pct > 0 && (
							<div className="flex justify-between items-center text-sm gap-2 text-green-700">
								<span>
									Sconto quantità ({quantityDiscount.unitCount} unità, -{quantityDiscount.pct}%)
								</span>
								<span className="font-medium shrink-0">-€{quantityDiscount.amt.toFixed(2)}</span>
							</div>
						)}
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
										const overriddenPrice = pkgDiscResult.priceOverrides.get(sel.publicId)

										let priceLabel: React.ReactNode
										if (svc.pricingType === "tiered") {
											const rawPrice = sel.tierLabel
												? svc.priceTiers?.find((t) => t.label === sel.tierLabel)?.price
												: null
											const origPrice = rawPrice != null ? Number(rawPrice) : null
											if (origPrice == null) {
												priceLabel = <em className="text-amber-500 font-normal text-xs">fascia non scelta</em>
											} else if (overriddenPrice !== undefined && overriddenPrice !== origPrice) {
												priceLabel = (
													<span className="text-right">
														<span className="line-through text-gray-400 text-xs mr-1">€{origPrice.toFixed(2)}</span>
														<span className="text-green-700 font-semibold">€{overriddenPrice.toFixed(2)}</span>
													</span>
												)
											} else {
												priceLabel = `€${origPrice.toFixed(2)}`
											}
										} else if (svc.pricingType === "fixed") {
											const origPrice = svc.basePrice != null ? Number(svc.basePrice) : null
											if (origPrice == null) {
												priceLabel = "—"
											} else if (overriddenPrice !== undefined && overriddenPrice !== origPrice) {
												priceLabel = (
													<span className="text-right">
														<span className="line-through text-gray-400 text-xs mr-1">€{origPrice.toFixed(2)}</span>
														<span className="text-green-700 font-semibold">€{overriddenPrice.toFixed(2)}</span>
													</span>
												)
											} else {
												priceLabel = `€${origPrice.toFixed(2)}`
											}
										} else if (svc.pricingType === "percentage") {
											priceLabel = (
												<span className="text-[#7c3aed]">
													+{svc.percentageValue}%
													{fastDeliveryAmount > 0 && ` (€${fastDeliveryAmount.toFixed(2)})`}
												</span>
											)
										}

										return (
											<div key={sel.publicId}>
												<div className="flex justify-between items-start text-sm gap-2">
													<span className="text-gray-700 leading-snug">
														{svc.name}
														{sel.tierLabel && (
															<span className="block text-xs text-gray-400">
																{sel.tierLabel}
																{sel.duration != null && ` (${formatDuration(sel.duration)})`}
															</span>
														)}
													</span>
													<span className="font-medium text-gray-900 shrink-0">{priceLabel}</span>
												</div>
												{(sel.selectedOptions ?? []).map((optId) => {
													const opt = svc.options?.find((o) => o.publicId === optId)
													if (!opt) return null
													const optOverride = pkgDiscResult.priceOverrides.get(optId)
													const optPrice = optOverride !== undefined ? optOverride : opt.price
													const optDiscounted = optOverride !== undefined && optOverride !== opt.price
													return (
														<div key={optId} className="flex justify-between items-center text-xs gap-2 mt-0.5 pl-2">
															<span className="text-gray-500">↳ {opt.name}</span>
															<span className="shrink-0">
																{optDiscounted ? (
																	<>
																		<span className="line-through text-gray-400 mr-1">+€{opt.price.toFixed(2)}</span>
																		<span className="text-green-700 font-medium">+€{optPrice.toFixed(2)}</span>
																	</>
																) : (
																	<span className="text-gray-700">+€{optPrice.toFixed(2)}</span>
																)}
															</span>
														</div>
													)
												})}
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
									{pkgDiscResult.mainPackage && (
										<div className="flex justify-between items-start text-sm gap-2 text-green-700">
											<span className="min-w-0 flex-1">
												<i className="fa-solid fa-tag text-xs mr-1" />
												{pkgDiscResult.mainPackage.name}
												{pkgDiscResult.bonusApplied && (
													<span className="ml-1 text-xs bg-green-100 text-green-800 px-1.5 py-0.5 rounded-full font-medium whitespace-nowrap">+ Bonus extra</span>
												)}
											</span>
											<span className="font-medium shrink-0">-€{pkgDiscResult.totalAmt.toFixed(2)}</span>
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

			<div className="px-4 pb-2">
				<button
					type="button"
					onClick={() => setShowDiscountInfo(true)}
					className="text-xs text-[#7c3aed] hover:underline inline-flex items-center gap-1"
				>
					<i className="fa-solid fa-circle-info text-[10px]" />
					Informazioni su sconti e pacchetti bonus
				</button>
			</div>

			<div className="px-4 pb-4 flex flex-col gap-2">
				<button
					type="button"
					onClick={handleSaveDraft}
					disabled={submitting || loadingServices}
					className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg border border-[#7c3aed] text-[#7c3aed] font-medium hover:bg-[#f5f3ff] disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer text-sm"
				>
					{submitting
						? <><i className="fa-solid fa-spinner fa-spin" /> Salvataggio…</>
						: <><i className="fa-solid fa-floppy-disk" /> Salva bozza</>
					}
				</button>
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

					{!isMulti && !hasEnteredBasicInfo ? (
						/* ── Schermata iniziale: solo coppia + data, centrata ── */
						<div className="flex items-center justify-center min-h-[calc(100vh-12rem)]">
							<div className="w-full max-w-md">
								<div className="text-center mb-8">
									<div className="w-14 h-14 rounded-full bg-[#ede9fe] flex items-center justify-center mx-auto mb-4">
										<i className="fa-solid fa-ring text-[#7c3aed] text-xl" />
									</div>
									<h1 className="text-2xl font-bold text-gray-900">Nuovo progetto</h1>
									<p className="text-sm text-gray-500 mt-1.5">Inserisci i dati del matrimonio per iniziare</p>
								</div>
								<div className="rounded-2xl border border-gray-200 bg-white shadow-sm p-6 md:p-8 space-y-5">
									<Input
										name="coupleName-0"
										type="text"
										label="Nomi della coppia *"
										value={currentEntry.coupleName}
										onChange={(e) => updateCurrentEntry("coupleName", e.target.value)}
										placeholder="Es. Mario e Laura"
									/>
									<DateTimePicker
										label="Data del matrimonio *"
										value={currentEntry.weddingDate || null}
										onChange={(date) => updateCurrentEntry("weddingDate", date ?? "")}
									/>
								</div>
							</div>
						</div>
					) : isMulti ? (
						/* ── Modalità multi: 3 pannelli ── */
						<div className="flex flex-col xl:flex-row gap-4 xl:gap-5">

							{/* Pannello sinistro: lista matrimoni */}
							<aside className="xl:w-72 shrink-0">
								<div className="xl:sticky xl:top-24 rounded-xl border border-gray-200 bg-white shadow-sm p-4 flex flex-col gap-3">
									<div>
										<h2 className="text-base font-bold text-gray-900">
											<i className="fa-solid fa-layer-group text-[#7c3aed] mr-2" />
											Matrimoni
										</h2>
										<p className="text-xs text-gray-400 mt-1 leading-relaxed">
											L'ordine definisce la priorità durante il montaggio.
										</p>
									</div>
									{entries.map((e, i) => {
										const isActive = i === selectedIdx
										return (
											<div
												key={i}
												onClick={() => setSelectedIdx(i)}
												className={`p-3 rounded-lg border-2 cursor-pointer transition-all ${isActive ? "border-[#7c3aed] bg-[#f5f3ff]" : "border-gray-200 hover:border-gray-300"}`}
											>
												{/* Riga superiore: badge numero + nome + frecce riordino */}
												<div className="flex items-center gap-2">
													<span className={`inline-flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-bold shrink-0 ${isActive ? "bg-[#7c3aed] text-white" : "bg-gray-200 text-gray-500"}`}>
														{i + 1}
													</span>
													<span className={`font-medium text-sm truncate flex-1 min-w-0 ${isActive ? "text-[#6d28d9]" : "text-gray-800"}`}>
														{e.coupleName || <em className="text-gray-400 font-normal">Matrimonio {i + 1}</em>}
													</span>
													<div className="flex gap-0.5 shrink-0">
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
												</div>
												{e.weddingDate && (
													<div className="text-xs text-gray-400 mt-1 truncate pl-7">
														<i className="fa-solid fa-ring text-[8px] mr-1 text-[#c4b5fd]" />
														{formatDate(e.weddingDate)}
													</div>
												)}

												{/* Azioni */}
												<div className="flex gap-2 mt-2">
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

								{/* Note matrimonio corrente */}
								<div className="rounded-xl border border-gray-200 bg-white shadow-sm p-6 md:p-8 space-y-4">
									<h2 className="text-lg font-semibold text-gray-900">Note</h2>
									<Textarea
										name={`generalNotes-${selectedIdx}`}
										label="Note generali"
										rows={4}
										value={currentEntry.generalNotes}
										onChange={(e) => updateCurrentEntry("generalNotes", e.target.value)}
										placeholder="Stile di montaggio, preferenze musicali, momenti da includere o escludere, etc."
									/>
									<Textarea
										name={`referenceVideo-${selectedIdx}`}
										label="Video di riferimento"
										rows={3}
										value={currentEntry.referenceVideo}
										onChange={(e) => updateCurrentEntry("referenceVideo", e.target.value)}
										placeholder="Link o descrizione di video che vorresti usare come riferimento stilistico."
									/>
								</div>
							</section>

							{/* Pannello destro: riepilogo */}
							<aside className="xl:w-80 shrink-0">
								<div className="xl:sticky xl:top-24">
									{renderSummaryPanel(true)}
								</div>
							</aside>
						</div>
					) : (
						/* ── Modalità singola con dati: 3 colonne ── */
						<div className="flex flex-col xl:flex-row gap-4 xl:gap-5">

							{/* Pannello sinistro: coppia/data + azioni */}
							<aside className="xl:w-72 shrink-0">
								<div className="xl:sticky xl:top-24 space-y-3">
									{renderCoupleHeader()}
									<button
										type="button"
										onClick={() => duplicateEntry(0)}
										className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-[#c4b5fd] text-[#7c3aed] font-medium hover:bg-[#f5f3ff] transition-colors cursor-pointer text-sm"
									>
										<i className="fa-solid fa-copy text-xs" />
										Duplica matrimonio
									</button>
									<button
										type="button"
										onClick={addEntry}
										className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-dashed border-[#c4b5fd] text-[#7c3aed] font-medium hover:bg-[#f5f3ff] transition-colors cursor-pointer text-sm"
									>
										<i className="fa-solid fa-plus text-xs" />
										Aggiungi un altro matrimonio
									</button>
								</div>
							</aside>

							{/* Pannello centrale: config servizi + note */}
							<section className="flex-1 min-w-0 space-y-4">
								{renderEntryConfig(false)}
								<div className="rounded-xl border border-gray-200 bg-white shadow-sm p-6 md:p-8 space-y-4">
									<h2 className="text-lg font-semibold text-gray-900">Note</h2>
									<Textarea
										name="generalNotes-0"
										label="Note generali"
										rows={4}
										value={currentEntry.generalNotes}
										onChange={(e) => updateCurrentEntry("generalNotes", e.target.value)}
										placeholder="Stile di montaggio, preferenze musicali, momenti da includere o escludere, etc."
									/>
									<Textarea
										name="referenceVideo-0"
										label="Video di riferimento"
										rows={3}
										value={currentEntry.referenceVideo}
										onChange={(e) => updateCurrentEntry("referenceVideo", e.target.value)}
										placeholder="Link o descrizione di video che vorresti usare come riferimento stilistico."
									/>
								</div>
							</section>

							{/* Pannello destro: riepilogo */}
							<aside className="xl:w-80 shrink-0">
								<div className="xl:sticky xl:top-24">
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

				{/* Modal duplica matrimonio */}
				{duplicateFromIdx !== null && (
					<div className="fixed inset-0 z-50 flex items-center justify-center p-4">
						<div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setDuplicateFromIdx(null)} />
						<div className="relative bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm">
							<div className="flex items-center gap-3 mb-1">
								<div className="w-10 h-10 rounded-full bg-[#ede9fe] flex items-center justify-center shrink-0">
									<i className="fa-solid fa-copy text-[#7c3aed]" />
								</div>
								<p className="font-semibold text-gray-900">Duplica</p>
							</div>
							<p className="text-xs text-gray-500 mb-5 leading-relaxed">
								Verrà copiata tutta la configurazione del matrimonio (servizi, materiali, impostazioni export) tranne le note generali e il video di riferimento.
							</p>
							<div className="space-y-3 mb-5">
								<Input
									name="duplicate-coupleName"
									type="text"
									label="Nomi della coppia *"
									value={duplicateCoupleName}
									onChange={(e) => setDuplicateCoupleName(e.target.value)}
									placeholder="Es. Mario e Laura"
								/>
								<DateTimePicker
									label="Data del matrimonio *"
									value={duplicateWeddingDate || null}
									onChange={(date) => setDuplicateWeddingDate(date ?? "")}
								/>
							</div>
							<div className="flex gap-3">
								<button
									type="button"
									onClick={() => setDuplicateFromIdx(null)}
									className="flex-1 py-2 rounded-lg border border-gray-200 text-gray-700 text-sm font-medium hover:bg-gray-50 transition-colors cursor-pointer"
								>
									Annulla
								</button>
								<button
									type="button"
									onClick={confirmDuplicate}
									disabled={!duplicateCoupleName.trim() || !duplicateWeddingDate}
									className="flex-1 py-2 rounded-lg bg-[#7c3aed] text-white text-sm font-medium hover:bg-[#6d28d9] disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer"
								>
									Duplica
								</button>
							</div>
						</div>
					</div>
				)}

				{/* Modal informazioni sconti */}
				{showDiscountInfo && (() => {
					const roleMap: Record<string, string> = {}
					for (const svc of services) {
						if (svc.discountRole) roleMap[svc.discountRole] = svc.name
						for (const opt of svc.options ?? []) {
							if (opt.discountRole) roleMap[opt.discountRole] = opt.name
						}
					}
					const mainPkgs = discountConfig.packages.filter(p => p.isBonus === 0)
					const bonusPkg = discountConfig.packages.find(p => p.isBonus === 1)

					const fmtRule = (rule: DiscountRule) => {
						const target = rule.targetRole
							? (roleMap[rule.targetRole] ?? rule.targetRole)
							: rule.targetCategory === 'extra' ? 'Servizi extra' : (rule.targetCategory ?? '?')
						return rule.type === 'new_price'
							? target + ': €' + rule.value
							: target + ': -' + rule.value + '%'
					}

					return (
						<div className="fixed inset-0 z-50 flex items-center justify-center p-4">
							<div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowDiscountInfo(false)} />
							<div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[85vh] flex flex-col">

								{/* Header fisso */}
								<div className="bg-[#ede9fe] px-5 py-4 border-b border-[#ddd6fe] flex items-center justify-between rounded-t-2xl shrink-0">
									<div className="flex items-center gap-2">
										<i className="fa-solid fa-tag text-[#7c3aed]" />
										<h2 className="text-base font-semibold text-[#6d28d9]">Sconti e pacchetti bonus</h2>
									</div>
									<button type="button" onClick={() => setShowDiscountInfo(false)} className="text-gray-400 hover:text-gray-600 transition-colors">
										<i className="fa-solid fa-xmark text-lg" />
									</button>
								</div>

								{/* Corpo scrollabile */}
								<div className="overflow-y-auto p-5 space-y-6">

									{/* Pacchetti principali */}
									{mainPkgs.length > 0 && (
										<section>
											<h3 className="text-sm font-semibold text-gray-700 mb-3">Pacchetti sconto</h3>
											<p className="text-xs text-gray-500 mb-3">
												Quando selezioni la combinazione richiesta in un singolo matrimonio, i prezzi dei servizi coinvolti vengono automaticamente aggiornati.
											</p>
											<div className="space-y-3">
												{mainPkgs.map((pkg, i) => {
													const allRoles = [...pkg.requiredRoles, ...(pkg.requiredRolesAnyOf ?? [])]
													return (
														<div key={i} className="border border-[#ddd6fe] rounded-xl p-3 bg-[#faf5ff]/60">
															<p className="text-sm font-medium text-gray-800 mb-2">{pkg.name}</p>
															<div className="mb-2.5">
																<p className="text-[11px] text-gray-400 uppercase tracking-wide mb-1.5">Servizi necessari</p>
																<div className="flex flex-wrap gap-1">
																	{allRoles.map(r => (
																		<span key={r} className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-[#ede9fe] text-[#6d28d9]">
																			{roleMap[r] ?? r}
																		</span>
																	))}
																</div>
															</div>
															<div>
																<p className="text-[11px] text-gray-400 uppercase tracking-wide mb-1.5">Prezzi con sconto</p>
																<ul className="space-y-1">
																	{pkg.discounts.map((rule, j) => (
																		<li key={j} className="flex items-center gap-1.5 text-xs text-[#6d28d9] font-medium">
																			<i className="fa-solid fa-tag text-[10px] shrink-0" />
																			{fmtRule(rule)}
																		</li>
																	))}
																</ul>
															</div>
														</div>
													)
												})}
											</div>
										</section>
									)}

									{/* Bonus extra */}
									{bonusPkg && (
										<section>
											<h3 className="text-sm font-semibold text-gray-700 mb-3">Bonus extra</h3>
											<div className="border border-green-200 rounded-xl p-3 bg-green-50/60">
												<p className="text-sm text-gray-700 mb-2.5">
													Quando è attivo almeno un pacchetto principale, tutti i <strong>servizi extra</strong> vengono scontati automaticamente:
												</p>
												<ul className="space-y-1">
													{bonusPkg.discounts.map((rule, j) => (
														<li key={j} className="flex items-center gap-1.5 text-xs text-green-700 font-medium">
															<i className="fa-solid fa-tag text-[10px] shrink-0" />
															{fmtRule(rule)}
														</li>
													))}
												</ul>
											</div>
										</section>
									)}

									{/* Sconti quantità */}
									{discountConfig.quantityTiers.some(t => t.discountPct > 0) && (
										<section>
											<h3 className="text-sm font-semibold text-gray-700 mb-2">Sconti quantità</h3>
											<p className="text-xs text-gray-500 mb-3">
												Applicati sull'intero ordine in base al numero totale di servizi principali (Teaser, Highlight, Wedding Film) su tutti i matrimoni.
											</p>
											<div className="rounded-xl border border-gray-200 overflow-hidden">
												<table className="w-full text-xs">
													<thead className="bg-gray-50 border-b border-gray-200">
														<tr>
															<th className="text-left py-2 px-3 font-medium text-gray-600">N° unità</th>
															<th className="text-right py-2 px-3 font-medium text-gray-600">Sconto ordine</th>
														</tr>
													</thead>
													<tbody>
														{discountConfig.quantityTiers.map((t, i) => (
															<tr key={i} className="border-b border-gray-100 last:border-0">
																<td className="py-2 px-3 text-gray-700">
																	{t.maxUnits != null ? t.minUnits + ' – ' + t.maxUnits : t.minUnits + '+'}
																</td>
																<td className="py-2 px-3 text-right font-semibold text-[#6d28d9]">
																	{t.discountPct > 0 ? '-' + t.discountPct + '%' : '—'}
																</td>
															</tr>
														))}
													</tbody>
												</table>
											</div>
										</section>
									)}

								</div>

								{/* Footer */}
								<div className="px-5 py-3 border-t border-gray-100 shrink-0">
									<button
										type="button"
										onClick={() => setShowDiscountInfo(false)}
										className="w-full py-2 rounded-lg border border-gray-200 text-gray-700 text-sm font-medium hover:bg-gray-50 transition-colors cursor-pointer"
									>
										Chiudi
									</button>
								</div>
							</div>
						</div>
					)
				})()}
			</form>
		</div>
	)
}

export default NewOrder
