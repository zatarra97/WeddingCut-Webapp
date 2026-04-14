import { useState, useEffect } from 'react'
import { toast } from 'react-toastify'
import Input from '../../../Components/Input'
import { genericGet, genericPut } from '../../../services/api-utility'

interface QuantityTier {
	id?: number
	minUnits: number
	maxUnits: number | null
	discountPct: number
	sortOrder: number
	isActive: number
}

interface DiscountRule {
	targetRole?: string
	targetCategory?: string
	type: 'new_price' | 'pct_off'
	value: number
}

interface DiscountPackage {
	id?: number
	name: string
	requiredRoles: string[]
	requiredRolesAnyOf: string[] | null
	discounts: DiscountRule[]
	unitCountIfApplied: number | null
	isBonus: number
	sortOrder: number
	isActive: number
}

const DISCOUNTS_PLACEHOLDER = JSON.stringify(
	[{ targetRole: 'teaser', type: 'new_price', value: 100 }],
	null,
	2,
)

const AdminDiscountConfig = () => {
	const [tiers, setTiers] = useState<QuantityTier[]>([])
	const [packages, setPackages] = useState<DiscountPackage[]>([])
	const [loadingTiers, setLoadingTiers] = useState(true)
	const [loadingPackages, setLoadingPackages] = useState(true)
	const [savingTiers, setSavingTiers] = useState(false)
	const [savingPackages, setSavingPackages] = useState(false)

	// Stato temporaneo per campi roles (comma-separated) e discounts (JSON text)
	const [rolesInput, setRolesInput] = useState<Record<number, string>>({})
	const [anyOfInput, setAnyOfInput] = useState<Record<number, string>>({})
	const [discountsText, setDiscountsText] = useState<Record<number, string>>({})

	useEffect(() => {
		genericGet('admin/discount/quantity-tiers')
			.then((data: QuantityTier[]) => setTiers(data))
			.catch(() => toast.error('Errore nel caricamento delle soglie quantità'))
			.finally(() => setLoadingTiers(false))

		genericGet('admin/discount/packages')
			.then((data: DiscountPackage[]) => {
				setPackages(data)
				const texts: Record<number, string> = {}
				data.forEach((p, i) => {
					texts[i] = JSON.stringify(p.discounts ?? [], null, 2)
				})
				setDiscountsText(texts)
			})
			.catch(() => toast.error('Errore nel caricamento dei pacchetti sconto'))
			.finally(() => setLoadingPackages(false))
	}, [])

	// ── Quantity Tiers ────────────────────────────────────────────────────────

	const addTier = () => {
		const maxSort = tiers.length ? Math.max(...tiers.map((t) => t.sortOrder)) : -1
		setTiers((prev) => [
			...prev,
			{ minUnits: 0, maxUnits: null, discountPct: 0, sortOrder: maxSort + 1, isActive: 1 },
		])
	}

	const updateTier = (idx: number, field: keyof QuantityTier, value: any) => {
		setTiers((prev) => prev.map((t, i) => (i === idx ? { ...t, [field]: value } : t)))
	}

	const removeTier = (idx: number) => {
		setTiers((prev) => prev.filter((_, i) => i !== idx))
	}

	const saveTiers = async () => {
		setSavingTiers(true)
		try {
			const updated = await genericPut('admin/discount/quantity-tiers', tiers)
			setTiers(updated)
			toast.success('Soglie quantità salvate.')
		} catch {
			toast.error('Errore nel salvataggio delle soglie.')
		} finally {
			setSavingTiers(false)
		}
	}

	// ── Packages ──────────────────────────────────────────────────────────────

	const addPackage = () => {
		const maxSort = packages.length ? Math.max(...packages.map((p) => p.sortOrder)) : -1
		const newIdx = packages.length
		const empty: DiscountPackage = {
			name: '',
			requiredRoles: [],
			requiredRolesAnyOf: null,
			discounts: [],
			unitCountIfApplied: null,
			isBonus: 0,
			sortOrder: maxSort + 1,
			isActive: 1,
		}
		setPackages((prev) => [...prev, empty])
		setRolesInput((prev) => ({ ...prev, [newIdx]: '' }))
		setAnyOfInput((prev) => ({ ...prev, [newIdx]: '' }))
		setDiscountsText((prev) => ({ ...prev, [newIdx]: '[]' }))
	}

	const updatePackage = (idx: number, field: keyof DiscountPackage, value: any) => {
		setPackages((prev) => prev.map((p, i) => (i === idx ? { ...p, [field]: value } : p)))
	}

	const removePackage = (idx: number) => {
		setPackages((prev) => prev.filter((_, i) => i !== idx))
		setRolesInput((prev) => { const n = { ...prev }; delete n[idx]; return n })
		setAnyOfInput((prev) => { const n = { ...prev }; delete n[idx]; return n })
		setDiscountsText((prev) => { const n = { ...prev }; delete n[idx]; return n })
	}

	const commitRoles = (idx: number) => {
		const raw = rolesInput[idx] ?? packages[idx].requiredRoles.join(', ')
		updatePackage(idx, 'requiredRoles', raw.split(',').map((r) => r.trim().toLowerCase()).filter(Boolean))
	}

	const commitAnyOf = (idx: number) => {
		const raw = anyOfInput[idx] ?? (packages[idx].requiredRolesAnyOf ?? []).join(', ')
		const roles = raw.split(',').map((r) => r.trim().toLowerCase()).filter(Boolean)
		updatePackage(idx, 'requiredRolesAnyOf', roles.length ? roles : null)
	}

	const savePackages = async () => {
		// Sincronizza campi testo → struttura prima di inviare
		const synced = packages.map((p, idx) => {
			let requiredRoles = p.requiredRoles
			if (rolesInput[idx] !== undefined) {
				requiredRoles = rolesInput[idx].split(',').map((r) => r.trim().toLowerCase()).filter(Boolean)
			}
			let requiredRolesAnyOf = p.requiredRolesAnyOf
			if (anyOfInput[idx] !== undefined) {
				const arr = anyOfInput[idx].split(',').map((r) => r.trim().toLowerCase()).filter(Boolean)
				requiredRolesAnyOf = arr.length ? arr : null
			}
			let discounts = p.discounts
			try {
				const text = discountsText[idx]
				if (text !== undefined) discounts = JSON.parse(text)
			} catch {
				// usa il valore precedente
			}
			return { ...p, requiredRoles, requiredRolesAnyOf, discounts }
		})

		// Controlla JSON valido per tutti i pacchetti
		for (let i = 0; i < synced.length; i++) {
			const text = discountsText[i]
			if (text !== undefined) {
				try { JSON.parse(text) } catch {
					toast.error(`Pacchetto ${i + 1}: il campo "Regole sconto" non è JSON valido.`)
					return
				}
			}
		}

		setSavingPackages(true)
		try {
			const updated = await genericPut('admin/discount/packages', synced)
			setPackages(updated)
			// Aggiorna i campi testo con i dati ricevuti dal server
			const texts: Record<number, string> = {}
			updated.forEach((p: DiscountPackage, i: number) => {
				texts[i] = JSON.stringify(p.discounts ?? [], null, 2)
			})
			setDiscountsText(texts)
			setRolesInput({})
			setAnyOfInput({})
			toast.success('Pacchetti sconto salvati.')
		} catch {
			toast.error('Errore nel salvataggio dei pacchetti.')
		} finally {
			setSavingPackages(false)
		}
	}

	return (
		<div className="container mx-auto p-4 md:p-6 space-y-10">
			<h1 className="text-2xl font-bold text-gray-800">Configurazione sconti</h1>

			{/* ── Sconti quantità ──────────────────────────────────────── */}
			<section className="bg-white rounded-xl border border-gray-200 p-5">
				<div className="mb-4">
					<h2 className="text-lg font-semibold text-gray-800">Sconti quantità</h2>
					<p className="text-sm text-gray-500 mt-0.5">
						Definisci le soglie di unità per applicare uno sconto percentuale all'intero ordine.
						Contano come unità solo i servizi con ruolo <code className="bg-gray-100 px-1 rounded">teaser</code>,{' '}
						<code className="bg-gray-100 px-1 rounded">highlight</code>,{' '}
						<code className="bg-gray-100 px-1 rounded">weddingfilm</code>.
					</p>
				</div>

				{loadingTiers ? (
					<div className="py-8 text-center text-gray-400 text-sm">Caricamento…</div>
				) : (
					<>
						<div className="space-y-2">
							<div className="hidden sm:grid grid-cols-[1fr_1fr_1fr_auto] gap-3 px-2 text-xs font-medium text-gray-500 uppercase tracking-wide">
								<span>Unità min.</span>
								<span>Unità max. (vuoto = illimitato)</span>
								<span>Sconto %</span>
								<span />
							</div>

							{tiers.map((tier, idx) => (
								<div key={idx} className="grid grid-cols-[1fr_1fr_1fr_auto] gap-3 items-end">
									<Input
										label={idx === 0 ? 'Unità min.' : undefined}
										type="number"
										min={0}
										value={tier.minUnits}
										onChange={(e) => updateTier(idx, 'minUnits', Number(e.target.value))}
									/>
									<Input
										label={idx === 0 ? 'Unità max.' : undefined}
										type="number"
										min={0}
										placeholder="Illimitato"
										value={tier.maxUnits ?? ''}
										onChange={(e) =>
											updateTier(idx, 'maxUnits', e.target.value === '' ? null : Number(e.target.value))
										}
									/>
									<Input
										label={idx === 0 ? 'Sconto %' : undefined}
										type="number"
										min={0}
										max={100}
										step={0.5}
										value={tier.discountPct}
										onChange={(e) => updateTier(idx, 'discountPct', Number(e.target.value))}
									/>
									<button
										type="button"
										onClick={() => removeTier(idx)}
										className="mb-0.5 flex items-center justify-center w-9 h-9 rounded-lg text-red-400 hover:bg-red-50 hover:text-red-600 transition-colors"
										title="Elimina soglia"
									>
										<i className="fa-solid fa-trash-can text-sm" />
									</button>
								</div>
							))}

							{tiers.length === 0 && (
								<p className="text-sm text-gray-400 text-center py-4">Nessuna soglia configurata.</p>
							)}
						</div>

						<div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-100">
							<button type="button" onClick={addTier} className="btn secondary-wire text-sm">
								<i className="fa-solid fa-plus mr-2" />Aggiungi soglia
							</button>
							<button
								type="button"
								onClick={saveTiers}
								disabled={savingTiers}
								className="btn primary bg-primary hover:bg-primary-dark text-sm"
							>
								{savingTiers ? <><i className="fa-solid fa-spinner fa-spin mr-2" />Salvataggio…</> : <><i className="fa-solid fa-floppy-disk mr-2" />Salva soglie</>}
							</button>
						</div>
					</>
				)}
			</section>

			{/* ── Pacchetti sconto ─────────────────────────────────────── */}
			<section className="bg-white rounded-xl border border-gray-200 p-5">
				<div className="mb-4">
					<h2 className="text-lg font-semibold text-gray-800">Pacchetti sconto</h2>
					<p className="text-sm text-gray-500 mt-0.5">
						Definisci combinazioni di servizi che attivano sconti per-ruolo sull'entry.
						Il pacchetto con il maggior numero di ruoli richiesti vince quando più pacchetti sono applicabili.
					</p>
				</div>

				{/* Legenda formato discounts */}
				<details className="mb-4 text-xs text-gray-500">
					<summary className="cursor-pointer font-medium text-gray-600 hover:text-gray-800">
						<i className="fa-solid fa-circle-info mr-1" />Formato "Regole sconto" (JSON)
					</summary>
					<div className="mt-2 bg-gray-50 rounded-lg p-3 font-mono text-[11px] leading-relaxed space-y-1">
						<p className="text-gray-700 font-sans font-medium">Array di oggetti con i seguenti campi:</p>
						<p><span className="text-violet-600">targetRole</span> — ruolo del servizio (es. "teaser", "highlight", "weddingfilm", "prewedding")</p>
						<p><span className="text-violet-600">targetCategory</span> — categoria del servizio (es. "extra")</p>
						<p><span className="text-violet-600">type</span> — <code>"new_price"</code> (prezzo fisso) oppure <code>"pct_off"</code> (% di riduzione)</p>
						<p><span className="text-violet-600">value</span> — valore numerico (prezzo in € o percentuale)</p>
						<p className="text-gray-700 font-sans mt-2">Esempio:</p>
						<pre className="bg-white border border-gray-200 rounded p-2">{DISCOUNTS_PLACEHOLDER}</pre>
					</div>
				</details>

				{loadingPackages ? (
					<div className="py-8 text-center text-gray-400 text-sm">Caricamento…</div>
				) : (
					<>
						<div className="space-y-5">
							{packages.map((pkg, idx) => (
								<div key={idx} className="border border-gray-200 rounded-xl p-4 bg-gray-50/40 space-y-4">
									{/* Header card */}
									<div className="flex items-center gap-2">
										<span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
											Pacchetto {idx + 1}{pkg.isBonus ? ' — Bonus' : ''}
										</span>
										<div className="flex-1" />
										<label className="flex items-center gap-1.5 text-xs text-gray-600 cursor-pointer">
											<input
												type="checkbox"
												checked={pkg.isBonus === 1}
												onChange={(e) => updatePackage(idx, 'isBonus', e.target.checked ? 1 : 0)}
												className="w-3.5 h-3.5 accent-primary"
											/>
											Bonus
										</label>
										<label className="flex items-center gap-1.5 text-xs text-gray-600 cursor-pointer">
											<input
												type="checkbox"
												checked={pkg.isActive === 1}
												onChange={(e) => updatePackage(idx, 'isActive', e.target.checked ? 1 : 0)}
												className="w-3.5 h-3.5 accent-primary"
											/>
											Attivo
										</label>
										<button
											type="button"
											onClick={() => removePackage(idx)}
											className="flex items-center justify-center w-7 h-7 rounded text-red-400 hover:bg-red-50 hover:text-red-600 transition-colors"
											title="Elimina pacchetto"
										>
											<i className="fa-solid fa-trash-can text-xs" />
										</button>
									</div>

									{/* Riga 1: nome + unitCountIfApplied */}
									<div className="grid grid-cols-1 sm:grid-cols-[2fr_1fr] gap-3">
										<Input
											label="Nome pacchetto"
											value={pkg.name}
											onChange={(e) => updatePackage(idx, 'name', e.target.value)}
											placeholder="Es. Teaser + Wedding Film"
										/>
										<Input
											label="Unità da contare se applicato (vuoto = numero reale)"
											type="number"
											min={1}
											placeholder="Es. 1"
											value={pkg.unitCountIfApplied ?? ''}
											onChange={(e) =>
												updatePackage(
													idx,
													'unitCountIfApplied',
													e.target.value === '' ? null : Number(e.target.value),
												)
											}
										/>
									</div>

									{/* Riga 2: requiredRoles + requiredRolesAnyOf */}
									<div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
										<div>
											<label className="form-label">Ruoli richiesti (AND — tutti devono essere presenti)</label>
											<input
												type="text"
												className="appearance-none border rounded-sm w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary bg-white text-sm"
												placeholder="Es. teaser"
												value={rolesInput[idx] !== undefined ? rolesInput[idx] : pkg.requiredRoles.join(', ')}
												onChange={(e) => setRolesInput((prev) => ({ ...prev, [idx]: e.target.value }))}
												onBlur={() => commitRoles(idx)}
											/>
											{pkg.requiredRoles.length > 0 && (
												<div className="flex flex-wrap gap-1 mt-1.5">
													{pkg.requiredRoles.map((r) => (
														<span key={r} className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-violet-100 text-violet-700">{r}</span>
													))}
												</div>
											)}
										</div>
										<div>
											<label className="form-label">Ruoli alternativi (OR — almeno uno deve essere presente)</label>
											<input
												type="text"
												className="appearance-none border rounded-sm w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary bg-white text-sm"
												placeholder="Es. highlight, weddingfilm"
												value={anyOfInput[idx] !== undefined ? anyOfInput[idx] : (pkg.requiredRolesAnyOf ?? []).join(', ')}
												onChange={(e) => setAnyOfInput((prev) => ({ ...prev, [idx]: e.target.value }))}
												onBlur={() => commitAnyOf(idx)}
											/>
											{(pkg.requiredRolesAnyOf ?? []).length > 0 && (
												<div className="flex flex-wrap gap-1 mt-1.5">
													{(pkg.requiredRolesAnyOf ?? []).map((r) => (
														<span key={r} className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">{r}</span>
													))}
												</div>
											)}
										</div>
									</div>

									{/* Regole sconto JSON */}
									<div>
										<label className="form-label">Regole sconto (JSON)</label>
										<textarea
											rows={6}
											className="appearance-none border rounded-sm w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary bg-white text-sm font-mono"
											placeholder={DISCOUNTS_PLACEHOLDER}
											value={discountsText[idx] ?? JSON.stringify(pkg.discounts ?? [], null, 2)}
											onChange={(e) =>
												setDiscountsText((prev) => ({ ...prev, [idx]: e.target.value }))
											}
											onBlur={() => {
												try {
													const parsed = JSON.parse(discountsText[idx] ?? '[]')
													updatePackage(idx, 'discounts', parsed)
												} catch {
													// JSON invalido: lascia lo stato UI, l'errore viene rilevato al salvataggio
												}
											}}
										/>
									</div>
								</div>
							))}

							{packages.length === 0 && (
								<p className="text-sm text-gray-400 text-center py-4">Nessun pacchetto configurato.</p>
							)}
						</div>

						<div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-100">
							<button type="button" onClick={addPackage} className="btn secondary-wire text-sm">
								<i className="fa-solid fa-plus mr-2" />Aggiungi pacchetto
							</button>
							<button
								type="button"
								onClick={savePackages}
								disabled={savingPackages}
								className="btn primary bg-primary hover:bg-primary-dark text-sm"
							>
								{savingPackages ? <><i className="fa-solid fa-spinner fa-spin mr-2" />Salvataggio…</> : <><i className="fa-solid fa-floppy-disk mr-2" />Salva pacchetti</>}
							</button>
						</div>
					</>
				)}
			</section>
		</div>
	)
}

export default AdminDiscountConfig
