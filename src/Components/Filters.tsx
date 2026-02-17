import { useEffect, useState } from "react"
import Input from "./Input"
import Select from "./Select"
import DateTimePicker from "./DateTimePicker"
import { useLocation } from "react-router-dom"

interface FiltersProps {
	filters: Filter[]
	onFilterChange: (name: string, value: string) => void
	entity: string
	/** Valori correnti dei filtri (es. dallo stato del genitore). Se forniti, vengono usati per visualizzare la selezione. */
	values?: Record<string, string>
}

interface FilterOption {
	value: string
	label: string
}

interface Filter {
	label: string | null
	name: string
	type: "text" | "select" | "boolean" | "numberOperator" | "dateOperator"
	options: FilterOption[]
	disabled?: boolean
}

const Filters = ({ filters, onFilterChange, entity, values: valuesFromParent }: FiltersProps) => {
	const location = useLocation()
	const [filterValues, setFilterValues] = useState<Record<string, string>>({})
	const [showFilters, setShowFilters] = useState(false)

	// Carica i filtri dal localStorage quando il componente viene montato
	useEffect(() => {
		const savedFilters = localStorage.getItem(`filters_${entity}`)
		if (savedFilters) {
			const parsedFilters = JSON.parse(savedFilters)
			setFilterValues(parsedFilters)
			// Applica i filtri salvati solo al mount iniziale
			if (Object.keys(filterValues).length === 0) {
				Object.entries(parsedFilters).forEach(([name, value]) => {
					onFilterChange(name, value as string)
				})
			}
		}
	}, [entity]) // Rimosso onFilterChange dalle dipendenze

	// Gestisce il cambio dei filtri e li salva nel localStorage
	const handleFilterChange = (name: string, value: string) => {
		// Aggiorna lo stato locale
		setFilterValues((prev) => ({
			...prev,
			[name]: value,
		}))

		// Recupera i filtri esistenti
		const existingFilters = localStorage.getItem(`filters_${entity}`)
		const currentFilters = existingFilters ? JSON.parse(existingFilters) : {}

		// Aggiorna i filtri
		const updatedFilters = {
			...currentFilters,
			[name]: value,
		}

		// Salva i nuovi filtri
		localStorage.setItem(`filters_${entity}`, JSON.stringify(updatedFilters))

		// Chiama la callback originale
		onFilterChange(name, value)
	}

	// Pulisce i filtri quando si cambia entità
	useEffect(() => {
		const currentPath = location.pathname.split("/")[1]
		const allStorageKeys = Object.keys(localStorage)

		allStorageKeys.forEach((key) => {
			if (key.startsWith("filters_") && !key.includes(currentPath)) {
				localStorage.removeItem(key)
			}
		})
	}, [location])

	// Valore effettivo da mostrare: preferisce i valori dal genitore se forniti
	const getDisplayValue = (name: string) => valuesFromParent?.[name] ?? filterValues[name] ?? ""

	// Calcola il numero di filtri attivi (esclude operatori senza valore, es. "gte:")
	const activeFiltersCount = Object.values(valuesFromParent ?? filterValues).filter((value) => {
		if (!value) return false
		// Non contare valori del tipo "op:" (operatore senza valore)
		return !/^[a-z]+:$/.test(value)
	}).length

	// Alterna la visualizzazione dei filtri
	const toggleFilters = () => {
		setShowFilters(!showFilters)
	}

	const filterClass = filters.length >= 6 ? "w-full md:w-1/2 lg:w-1/3 xl:w-1/5" : "w-full md:w-1/2 lg:w-1/3 xl:w-1/5"

	return (
		<div className="mb-6">
			{/* Pulsante per mostrare/nascondere i filtri su mobile */}
			<div className="md:hidden mb-4">
				<button
					onClick={toggleFilters}
					className="flex items-center justify-between w-full bg-gradient-to-r from-gray-50 to-gray-100 hover:from-gray-100 hover:to-gray-200 border border-gray-200 hover:border-gray-300 rounded-xl px-4 py-3 text-left transition-all duration-200 shadow-sm hover:shadow-md"
				>
					<div className="flex items-center">
						<div className="bg-gradient-to-r from-blue-500 to-blue-600 w-8 h-8 rounded-lg mr-3 shadow-sm flex items-center justify-center">
							<i className="fa-solid fa-filter text-white text-sm"></i>
						</div>
						<span className="font-semibold text-gray-700">Filtri</span>
						{activeFiltersCount > 0 && (
							<span className="ml-3 px-2.5 py-1 bg-gradient-to-r from-blue-500 to-blue-600 text-white text-xs rounded-full font-bold shadow-sm">
								{activeFiltersCount}
							</span>
						)}
					</div>
					<div className="bg-white w-6 h-6 rounded-lg shadow-sm flex items-center justify-center">
						<i className={`fa-solid ${showFilters ? "fa-chevron-up" : "fa-chevron-down"} text-gray-600 text-xs`}></i>
					</div>
				</button>
			</div>

			{/* Contenitore dei filtri - sempre visibile su desktop, condizionale su mobile */}
			<div
				className={`${
					showFilters ? "block" : "hidden"
				} md:block relative bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl shadow-lg border border-blue-200 px-6 pt-6 pb-4`}
			>
				<div className="flex flex-wrap -mx-2">
					{filters.map((filter) => (
						<div key={filter.name} className={`${filterClass} px-2 mb-3`}>
							{filter.type === "text" && (
								<Input
									label={filter.label || "Campo"}
									type="text"
									name={filter.name}
									value={getDisplayValue(filter.name)}
									placeholder={`Cerca per ${filter.label?.toLowerCase() || "campo"}...`}
									onChange={(e) => handleFilterChange(filter.name, e.target.value || "")}
								/>
							)}
							{filter.type === "select" && (
								<Select
									label={filter.label || "Campo"}
									name={filter.name}
									value={getDisplayValue(filter.name)}
									options={filter.options}
									disabled={filter.disabled}
									onChange={(e) => handleFilterChange(filter.name, String(e.target.value ?? ""))}
								/>
							)}
							{filter.type === "boolean" && (
								<Select
									label={filter.label || "Campo"}
									name={filter.name}
									value={getDisplayValue(filter.name)}
									options={filter.options}
									onChange={(e) => handleFilterChange(filter.name, String(e.target.value ?? ""))}
								/>
							)}
							{filter.type === "numberOperator" && (
								<div>
									<label className="block text-sm font-bold text-gray-700 mb-1">{filter.label || "Campo"}</label>
									{(() => {
										const raw = getDisplayValue(filter.name) || ""
										const hasColon = raw.includes(":")
										const parsedOp = hasColon ? raw.split(":")[0] : "eq"
										const allowedOps = ["eq", "neq", "lt", "lte", "gt", "gte"]
										const currentOp = allowedOps.includes(parsedOp) ? parsedOp : "eq"
										const rest = hasColon ? raw.slice(currentOp.length + 1) : raw
										const firstVal = rest || ""

										const setValue = (op: string, v1?: string) => {
											let payload = ""
											const a = (v1 || "").trim()
											// Salva sempre l'operatore; se il valore è vuoto resta "op:"
											payload = `${op}:${a}`
											handleFilterChange(filter.name, payload)
										}

										const opOptions = [
											{ value: "eq", label: "=" },
											{ value: "neq", label: "≠" },
											{ value: "lt", label: "<" },
											{ value: "lte", label: "≤" },
											{ value: "gt", label: ">" },
											{ value: "gte", label: "≥" },
										]

										return (
											<div className="flex items-center gap-1 mt-2">
												<div className="w-1/2">
													<Select
														label={undefined}
														name={`${filter.name}_op`}
														value={currentOp}
														options={opOptions}
														onChange={(e) => setValue(String(e.target.value), firstVal)}
														placeholder=""
														disabled={false}
													/>
												</div>
												<div className="w-1/2">
													<Input
														type="number"
														name={`${filter.name}_value`}
														inputMode="decimal"
														placeholder="valore"
														value={firstVal}
														onChange={(e) => setValue(currentOp, (e.target as HTMLInputElement).value)}
													/>
												</div>
											</div>
										)
									})()}
								</div>
							)}
							{filter.type === "dateOperator" && (
								<div>
									<label className="block text-sm font-bold text-gray-700 mb-1">{filter.label || "Campo"}</label>
									{(() => {
										const raw = getDisplayValue(filter.name) || ""
										const hasColon = raw.includes(":")
										const parsedOp = hasColon ? raw.split(":")[0] : "eq"
										const allowedOps = ["eq", "neq", "lt", "lte", "gt", "gte"]
										const currentOp = allowedOps.includes(parsedOp) ? parsedOp : "eq"
										const rest = hasColon ? raw.slice(currentOp.length + 1) : raw
										const firstVal = rest || ""

										const setValue = (op: string, v1?: string | null) => {
											const a = (v1 || "").trim()
											const payload = `${op}:${a}`
											handleFilterChange(filter.name, payload)
										}

										const opOptions = [
											{ value: "eq", label: "=" },
											{ value: "neq", label: "≠" },
											{ value: "lt", label: "<" },
											{ value: "lte", label: "≤" },
											{ value: "gt", label: ">" },
											{ value: "gte", label: "≥" },
										]

										return (
											<div className="flex items-center gap-1 mt-2">
												<div className="w-1/2">
													<Select
														label={undefined}
														name={`${filter.name}_op`}
														value={currentOp}
														options={opOptions}
														onChange={(e) => setValue(String(e.target.value), firstVal)}
														placeholder=""
														disabled={false}
													/>
												</div>
												<div className="w-1/2">
													<DateTimePicker
														label={undefined}
														value={firstVal || null}
														onChange={(date) => setValue(currentOp, date)}
													/>
												</div>
											</div>
										)
									})()}
								</div>
							)}
						</div>
					))}
				</div>
			</div>
		</div>
	)
}

export default Filters
