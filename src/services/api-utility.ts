import axios from "axios"
import { toast } from "react-toastify"
import { LOCAL_STORAGE_KEYS } from "../constants"
import { isDemoActive, anonymizeEntityList, anonymizeEntityItem, anonymizeList, getAnonymizationRules } from "./demo-utility"

// Funzione helper per ottenere la configurazione dell'header
const getConfig = (): { headers?: { Authorization: string } } => {
	const token = localStorage.getItem("idToken") || localStorage.getItem("accessToken")
	if (!token) {
		console.warn("No JWT token found in localStorage")
		return {}
	}
	return {
		headers: { Authorization: `Bearer ${token}` },
	}
}

const sessionExpired = (): void => {
	console.error("Authentication failed. Redirecting to login...")
	toast.error("Sessione scaduta, esegui nuovamente il login")
	localStorage.clear() // Pulisce il localStorage
	window.location.href = "/login" // Reindirizza alla pagina di login
}

// ping di controllo connessione al backend
export const ping = async (): Promise<any> => {
	try {
		const response = await axios.get(`${import.meta.env.VITE_BACKEND_URL}/ping`)
		return response.data
	} catch (error) {
		console.error("Error:", error)
		throw error
	}
}

// Lista dell'entità
type Filters = Record<string, any>
type Pagination = { limit?: number; skip?: number }

// Funzione helper per determinare se un campo è booleano
const isBooleanField = (fieldName: string): boolean => {
	const booleanFields = ["registerEnabled", "registerSelfConsumption", "licenseNeeded", "isActive", "enabled"]
	return booleanFields.includes(fieldName) || fieldName.endsWith("Enabled") || fieldName.endsWith("Active")
}

// Conta il numero di entità
export const getCount = async (entity: string): Promise<number> => {
	try {
		const response = await axios.get(`${import.meta.env.VITE_BACKEND_URL}/${entity}/count`)
		return response.data.count
	} catch (error: any) {
		console.error("Error fetching count:", error)
		throw error
	}
}

// Conta con where nativo (JSON stringificato in query)
export const getCountWhere = async (entity: string, where: Record<string, any> = {}): Promise<number> => {
	try {
		const url = new URL(`${import.meta.env.VITE_BACKEND_URL}/${entity}/count`)
		const params = new URLSearchParams()
		if (where && Object.keys(where).length > 0) {
			params.append("where", JSON.stringify(where))
		}
		url.search = params.toString()
		const response = await axios.get(url.toString(), getConfig())
		return response.data.count
	} catch (error: any) {
		console.error("Error fetching filtered count:", error)
		if (error.response && error.response.status === 401) {
			sessionExpired()
		}
		throw error
	}
}

export const getList = async (
	entity: string,
	filters: Filters = {},
	pagination: Pagination = {},
	sortField: string | null = null,
): Promise<any[]> => {
	const url = new URL(`${import.meta.env.VITE_BACKEND_URL}/${entity}`)

	// Creiamo l'oggetto filtro base
	const filterObj: any = { where: {} }

	// Gestione dei filtri
	Object.entries(filters).forEach(([key, value]) => {
		if (value) {
			// Gestione speciale: filtro con operatore per registerExpirationDate
			if (key === "registerExpirationDate") {
				try {
					const raw: string = String(value).trim()
					if (!raw) {
						return
					}
					const hasColon = raw.includes(":")
					const op = hasColon ? raw.split(":")[0] : "eq"
					const rest = hasColon ? raw.slice(op.length + 1) : raw
					const dateValue = (rest || "").trim()
					if (!dateValue) {
						return
					}
					if (op === "eq") {
						filterObj.where.registerExpirationDate = dateValue
					} else if (["neq", "gt", "gte", "lt", "lte"].includes(op)) {
						filterObj.where.registerExpirationDate = { [op]: dateValue }
					}
				} catch (e) {
					console.warn("registerExpirationDate parse error:", e)
				}
				return
			}

			// Gestione speciale: filtro con operatore per totalPower
			if (key === "totalPowerFilter") {
				try {
					const raw: string = String(value).trim()
					if (!raw) {
						return
					}
					const hasColon = raw.includes(":")
					const op = hasColon ? raw.split(":")[0] : "eq"
					const rest = hasColon ? raw.slice(op.length + 1) : raw
					const toNumber = (s: string) => {
						const n = Number(s)
						return Number.isFinite(n) ? n : undefined
					}
					if (op === "between") {
						const [a, b] = (rest || "").split(",").map((p) => toNumber(p.trim()))
						if (a !== undefined && b !== undefined) {
							filterObj.where.totalPower = { between: [a, b] }
						}
					} else if (op === "inq") {
						const arr = (rest || "")
							.split(",")
							.map((p) => toNumber(p.trim()))
							.filter((n) => n !== undefined) as number[]
						if (arr.length > 0) {
							filterObj.where.totalPower = { inq: arr }
						}
					} else if (["eq", "neq", "gt", "gte", "lt", "lte"].includes(op)) {
						const num = toNumber(rest)
						if (num !== undefined) {
							if (op === "eq") {
								// Uguaglianza: valore diretto
								filterObj.where.totalPower = num
							} else {
								filterObj.where.totalPower = { [op]: num }
							}
						}
					}
				} catch (e) {
					console.warn("totalPowerFilter parse error:", e)
				}
				return
			}

			if (key.includes("Inequality")) {
				// Gestione dei filtri di uguaglianza e disuguaglianza
				const fieldName = key.replace("Inequality", "")
				if (value.includes("neq")) {
					filterObj.where[fieldName] = { neq: null }
				} else if (value.includes("eq")) {
					filterObj.where[fieldName] = { eq: null }
				}
			} else if (key.includes("Id") && key !== "paramId") {
				filterObj.where[key] = value
			} else if (isBooleanField(key)) {
				// Gestione specifica per i campi booleani
				filterObj.where[key] = value === "true"
			} else {
				filterObj.where[key] = { like: `%${value}%`, options: "i" }
			}
		}
	})

	// Aggiungiamo la paginazione al filtro
	if (pagination.limit) {
		filterObj.limit = pagination.limit
	}
	if (pagination.skip) {
		filterObj.skip = pagination.skip
	}

	// Aggiungiamo l'ordinamento se specificato
	if (sortField) {
		filterObj.order = sortField
	}

	// Aggiungiamo il filtro come parametro URL
	url.searchParams.append("filter", JSON.stringify(filterObj))

	try {
		const response = await axios.get(url.toString(), getConfig())
		const data = response.data

		// Anonimizzazione in modalità demo (centralizzata)
		if (isDemoActive()) {
			return anonymizeEntityList(entity, data)
		}

		return data
	} catch (error: any) {
		console.error("Error fetching data:", error)
		if (error.response && error.response.status === 401) {
			sessionExpired()
		}
		throw error
	}
}

// Dettaglio dell'entità
export const getItem = async (entity: string, id: string | number): Promise<any> => {
	try {
		const response = await axios.get(`${import.meta.env.VITE_BACKEND_URL}/${entity}/${id}`, getConfig())
		const data = response.data
		if (isDemoActive()) {
			return anonymizeEntityItem(entity, data)
		}
		return data
	} catch (error: any) {
		console.error("Error:", error)
		if (error.response && error.response.status === 401) {
			sessionExpired()
		}
		throw error
	}
}

// Chiamata GET generica per endpoint custom
export const genericGet = async (endpoint: string): Promise<any> => {
	try {
		const response = await axios.get(`${import.meta.env.VITE_BACKEND_URL}/${endpoint}`, getConfig())
		return response.data
	} catch (error: any) {
		console.error("Error:", error)
		if (error.response && error.response.status === 401) {
			sessionExpired()
		}
		throw error
	}
}

// Chiamata POST generica per endpoint custom
export const genericPost = async (endpoint: string, data: any = {}): Promise<any> => {
	if (localStorage.getItem(LOCAL_STORAGE_KEYS.DEMO_MODE) === "true") {
		window.dispatchEvent(new Event("open-demo-modal"))
		return data
	}
	try {
		const response = await axios.post(`${import.meta.env.VITE_BACKEND_URL}/${endpoint}`, data, getConfig())
		return response.data
	} catch (error: any) {
		console.error("Error:", error.response?.data?.error?.message || error.message)
		if (error.response && error.response.status === 401) {
			sessionExpired()
		}
		throw error
	}
}

// Ottiene una presigned URL per upload o download
export const getPresignedUrl = async (
	entity: string,
	id: string | number,
	type: "upload" | "download",
	data?: Record<string, any>,
): Promise<{ presignedUrl: string; s3Path?: string }> => {
	const endpoint = `${entity}/${id}/presigned-url-${type}`
	const payload = data || {}
	return await createItem(endpoint, payload)
}

// Creazione dell'entità
export const createItem = async (entity: string, data: any): Promise<any> => {
	if (localStorage.getItem(LOCAL_STORAGE_KEYS.DEMO_MODE) === "true") {
		window.dispatchEvent(new Event("open-demo-modal"))
		return data
	}
	try {
		const response = await axios.post(`${import.meta.env.VITE_BACKEND_URL}/${entity}`, data, getConfig())
		return response.data
	} catch (error: any) {
		console.error("Error:", error.response?.data?.error?.message || error.message)
		if (error.response && error.response.status === 401) {
			sessionExpired()
		}
		throw error
	}
}

// Aggiornamento dell'entità
export const updateItem = async (entity: string, id: string | number, data: any = {}): Promise<any> => {
	if (localStorage.getItem(LOCAL_STORAGE_KEYS.DEMO_MODE) === "true") {
		window.dispatchEvent(new Event("open-demo-modal"))
		return data
	}
	try {
		const response = await axios.put(`${import.meta.env.VITE_BACKEND_URL}/${entity}/${id}`, data, getConfig())
		return response.data
	} catch (error: any) {
		console.error("Error:", error.response?.data?.error?.message || error.message)
		if (error.response && error.response.status === 401) {
			sessionExpired()
		}
		throw error
	}
}

// Eliminazione dell'entità
export const deleteItem = async (entity: string, id: string | number): Promise<void> => {
	if (localStorage.getItem(LOCAL_STORAGE_KEYS.DEMO_MODE) === "true") {
		window.dispatchEvent(new Event("open-demo-modal"))
		return
	}
	try {
		await axios.delete(`${import.meta.env.VITE_BACKEND_URL}/${entity}/${id}`, getConfig())
	} catch (error: any) {
		console.error("Error:", error.response?.data?.error?.message || error.message)
		if (error.response && error.response.status === 401) {
			sessionExpired()
		}
		throw error
	}
}

// Lista dell'entità con filtri di uguaglianza stretta
export const getListWithExactFilters = async (
	entity: string,
	exactFilters: Filters = {},
	otherFilters: Filters = {},
	pagination: Pagination = {},
	sortField: string | null = null,
): Promise<any[]> => {
	const url = new URL(`${import.meta.env.VITE_BACKEND_URL}/${entity}`)

	// Creiamo l'oggetto filtro base
	const filterObj: any = { where: {} }

	// Gestione dei filtri con uguaglianza stretta
	Object.entries(exactFilters).forEach(([key, value]) => {
		if (value !== undefined && value !== null && value !== "") {
			filterObj.where[key] = value
		}
	})

	// Gestione degli altri filtri (con like per i campi di testo)
	Object.entries(otherFilters).forEach(([key, value]) => {
		if (value) {
			if (key.includes("Inequality")) {
				// Gestione dei filtri di uguaglianza e disuguaglianza
				const fieldName = key.replace("Inequality", "")
				if (value.includes("neq")) {
					filterObj.where[fieldName] = { neq: null }
				} else if (value.includes("eq")) {
					filterObj.where[fieldName] = { eq: null }
				}
			} else if (key.includes("Id") && key !== "paramId") {
				filterObj.where[key] = value
			} else if (isBooleanField(key)) {
				// Gestione specifica per i campi booleani
				filterObj.where[key] = value === "true"
			} else {
				filterObj.where[key] = { like: `%${value}%`, options: "i" }
			}
		}
	})

	// Aggiungiamo la paginazione al filtro
	if (pagination.limit) {
		filterObj.limit = pagination.limit
	}
	if (pagination.skip) {
		filterObj.skip = pagination.skip
	}

	// Aggiungiamo l'ordinamento se specificato
	if (sortField) {
		filterObj.order = sortField
	}

	// Aggiungiamo il filtro come parametro URL
	url.searchParams.append("filter", JSON.stringify(filterObj))

	try {
		const response = await axios.get(url.toString(), getConfig())
		const data = response.data

		// Anonimizzazione in modalità demo (centralizzata)
		if (isDemoActive()) {
			return anonymizeEntityList(entity, data)
		}

		return data
	} catch (error: any) {
		console.error("Error fetching data:", error)
		if (error.response && error.response.status === 401) {
			sessionExpired()
		}
		throw error
	}
}

// Richieste GET generiche con query string
// Utilizzare per endpoint custom (es. dashboard) che non seguono il pattern standard filter
export const getByQuery = async (path: string, params: Record<string, string | number | boolean>): Promise<any> => {
	const url = new URL(`${import.meta.env.VITE_BACKEND_URL}/${path}`)

	// Appende i parametri di query in modo sicuro
	Object.entries(params).forEach(([key, value]) => {
		if (value !== undefined && value !== null) {
			url.searchParams.append(key, String(value).trim())
		}
	})

	try {
		const response = await axios.get(url.toString(), getConfig())
		const data = response.data
		// Se siamo in demo e si tratta di dashboard, applichiamo regole centralizzate
		if (isDemoActive() && path.includes("dashboard")) {
			const rules = getAnonymizationRules("dashboard")
			if (rules) {
				if (Array.isArray(data)) {
					return anonymizeList(data, rules as any)
				} else if (data && typeof data === "object") {
					// Alcuni endpoint dashboard potrebbero ritornare un oggetto con una lista
					// Applichiamo le regole direttamente se è un item unico
					return anonymizeEntityItem("dashboard", data)
				}
			}
		}
		return data
	} catch (error: any) {
		console.error("Error fetching data:", error)
		if (error.response && error.response.status === 401) {
			sessionExpired()
		}
		throw error
	}
}
