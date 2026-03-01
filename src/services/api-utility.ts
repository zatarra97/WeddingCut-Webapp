import axios, {AxiosRequestConfig} from "axios"
import {CognitoUserPool} from "amazon-cognito-identity-js"
import {toast} from "react-toastify"
import {LOCAL_STORAGE_KEYS} from "../constants"

// ---------------------------------------------------------------------------
// Cognito user pool (usato solo per il silent refresh del token)
// ---------------------------------------------------------------------------
const userPool = new CognitoUserPool({
	UserPoolId: import.meta.env.VITE_COGNITO_USER_POOL_ID,
	ClientId: import.meta.env.VITE_COGNITO_CLIENT_ID,
})

// Tenta il refresh silenzioso usando il refreshToken Cognito.
// La SDK amazon-cognito-identity-js gestisce internamente il refreshToken.
// Restituisce il nuovo idToken oppure null se il refresh non è possibile.
const silentTokenRefresh = (): Promise<string | null> => {
	return new Promise((resolve) => {
		const cognitoUser = userPool.getCurrentUser()
		if (!cognitoUser) {
			resolve(null)
			return
		}
		cognitoUser.getSession((err: Error | null, session: any) => {
			if (err || !session?.isValid()) {
				resolve(null)
				return
			}
			const newIdToken: string = session.getIdToken().getJwtToken()
			const newAccessToken: string = session.getAccessToken().getJwtToken()
			localStorage.setItem(LOCAL_STORAGE_KEYS.ID_TOKEN, newIdToken)
			localStorage.setItem(LOCAL_STORAGE_KEYS.ACCESS_TOKEN, newAccessToken)
			localStorage.setItem(LOCAL_STORAGE_KEYS.JWT_TOKEN, newIdToken)
			resolve(newIdToken)
		})
	})
}

const sessionExpired = (): void => {
	console.error("Authentication failed. Redirecting to login...")
	toast.error("Sessione scaduta, esegui nuovamente il login")
	localStorage.clear()
	window.location.href = "/login"
}

// ---------------------------------------------------------------------------
// Istanza axios autenticata con interceptor
// Tutte le chiamate API protette passano da qui.
// ---------------------------------------------------------------------------
const apiClient = axios.create()

// Request interceptor: aggiunge il Bearer token ad ogni richiesta
apiClient.interceptors.request.use((config) => {
	const token =
		localStorage.getItem(LOCAL_STORAGE_KEYS.ID_TOKEN) ||
		localStorage.getItem(LOCAL_STORAGE_KEYS.ACCESS_TOKEN)
	if (token) {
		config.headers.Authorization = `Bearer ${token}`
	}
	return config
})

// Response interceptor: su 401 tenta il silent refresh e riprova una volta.
// Se il refresh fallisce, reindirizza al login.
apiClient.interceptors.response.use(
	(response) => response,
	async (error) => {
		const originalRequest = error.config as AxiosRequestConfig & {_retry?: boolean}

		if (error.response?.status === 401 && !originalRequest._retry) {
			originalRequest._retry = true

			const newToken = await silentTokenRefresh()
			if (newToken) {
				originalRequest.headers = {
					...originalRequest.headers,
					Authorization: `Bearer ${newToken}`,
				}
				return apiClient(originalRequest)
			}

			sessionExpired()
			// Restituisce una promise che non risolve mai: la navigazione verso /login
			// smonta i componenti, i catch successivi non verranno eseguiti.
			return new Promise(() => {})
		}

		return Promise.reject(error)
	},
)

// ---------------------------------------------------------------------------
// Ping — chiamata senza autenticazione per il controllo della connessione
// ---------------------------------------------------------------------------
export const ping = async (): Promise<any> => {
	try {
		const response = await axios.get(`${import.meta.env.VITE_BACKEND_URL}/ping`)
		return response.data
	} catch (error) {
		console.error("Error:", error)
		throw error
	}
}

// ---------------------------------------------------------------------------
// Helpers per filtri e paginazione
// ---------------------------------------------------------------------------
type Filters = Record<string, any>
type Pagination = {limit?: number; skip?: number}

const isBooleanField = (fieldName: string): boolean => {
	const booleanFields = ["registerEnabled", "registerSelfConsumption", "licenseNeeded", "isActive", "enabled"]
	return booleanFields.includes(fieldName) || fieldName.endsWith("Enabled") || fieldName.endsWith("Active")
}

// ---------------------------------------------------------------------------
// API — conteggi
// ---------------------------------------------------------------------------
export const getCount = async (entity: string): Promise<number> => {
	try {
		const response = await apiClient.get(`${import.meta.env.VITE_BACKEND_URL}/${entity}/count`)
		return response.data.count
	} catch (error: any) {
		console.error("Error fetching count:", error)
		throw error
	}
}

export const getCountWhere = async (entity: string, where: Record<string, any> = {}): Promise<number> => {
	try {
		const url = new URL(`${import.meta.env.VITE_BACKEND_URL}/${entity}/count`)
		const params = new URLSearchParams()
		if (where && Object.keys(where).length > 0) {
			params.append("where", JSON.stringify(where))
		}
		url.search = params.toString()
		const response = await apiClient.get(url.toString())
		return response.data.count
	} catch (error: any) {
		console.error("Error fetching filtered count:", error)
		throw error
	}
}

// ---------------------------------------------------------------------------
// API — liste
// ---------------------------------------------------------------------------
export const getList = async (
	entity: string,
	filters: Filters = {},
	pagination: Pagination = {},
	sortField: string | null = null,
): Promise<any[]> => {
	const url = new URL(`${import.meta.env.VITE_BACKEND_URL}/${entity}`)
	const filterObj: any = {where: {}}

	Object.entries(filters).forEach(([key, value]) => {
		if (value) {
			if (key === "registerExpirationDate") {
				try {
					const raw: string = String(value).trim()
					if (!raw) return
					const hasColon = raw.includes(":")
					const op = hasColon ? raw.split(":")[0] : "eq"
					const rest = hasColon ? raw.slice(op.length + 1) : raw
					const dateValue = (rest || "").trim()
					if (!dateValue) return
					if (op === "eq") {
						filterObj.where.registerExpirationDate = dateValue
					} else if (["neq", "gt", "gte", "lt", "lte"].includes(op)) {
						filterObj.where.registerExpirationDate = {[op]: dateValue}
					}
				} catch (e) {
					console.warn("registerExpirationDate parse error:", e)
				}
				return
			}

			if (key === "totalPowerFilter") {
				try {
					const raw: string = String(value).trim()
					if (!raw) return
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
							filterObj.where.totalPower = {between: [a, b]}
						}
					} else if (op === "inq") {
						const arr = (rest || "")
							.split(",")
							.map((p) => toNumber(p.trim()))
							.filter((n) => n !== undefined) as number[]
						if (arr.length > 0) {
							filterObj.where.totalPower = {inq: arr}
						}
					} else if (["eq", "neq", "gt", "gte", "lt", "lte"].includes(op)) {
						const num = toNumber(rest)
						if (num !== undefined) {
							filterObj.where.totalPower = op === "eq" ? num : {[op]: num}
						}
					}
				} catch (e) {
					console.warn("totalPowerFilter parse error:", e)
				}
				return
			}

			if (key.includes("Inequality")) {
				const fieldName = key.replace("Inequality", "")
				if (value.includes("neq")) {
					filterObj.where[fieldName] = {neq: null}
				} else if (value.includes("eq")) {
					filterObj.where[fieldName] = {eq: null}
				}
			} else if (key.includes("Id") && key !== "paramId") {
				filterObj.where[key] = value
			} else if (isBooleanField(key)) {
				filterObj.where[key] = value === "true"
			} else {
				filterObj.where[key] = {like: `%${value}%`, options: "i"}
			}
		}
	})

	if (pagination.limit) filterObj.limit = pagination.limit
	if (pagination.skip) filterObj.skip = pagination.skip
	if (sortField) filterObj.order = sortField

	url.searchParams.append("filter", JSON.stringify(filterObj))

	const response = await apiClient.get(url.toString())
	return response.data
}

// ---------------------------------------------------------------------------
// API — dettaglio singolo
// ---------------------------------------------------------------------------
export const getItem = async (entity: string, id: string | number): Promise<any> => {
	const response = await apiClient.get(`${import.meta.env.VITE_BACKEND_URL}/${entity}/${id}`)
	return response.data
}

// ---------------------------------------------------------------------------
// API — chiamate generiche
// ---------------------------------------------------------------------------
export const genericGet = async (endpoint: string): Promise<any> => {
	try {
		const response = await apiClient.get(`${import.meta.env.VITE_BACKEND_URL}/${endpoint}`)
		return response.data
	} catch (error: any) {
		console.error("Error:", error)
		throw error
	}
}

export const genericPatch = async (endpoint: string, data: any = {}): Promise<any> => {
	try {
		const response = await apiClient.patch(`${import.meta.env.VITE_BACKEND_URL}/${endpoint}`, data)
		return response.data
	} catch (error: any) {
		console.error("Error:", error.response?.data?.error?.message || error.message)
		throw error
	}
}

export const genericDelete = async (endpoint: string): Promise<void> => {
	try {
		await apiClient.delete(`${import.meta.env.VITE_BACKEND_URL}/${endpoint}`)
	} catch (error: any) {
		console.error("Error:", error.response?.data?.error?.message || error.message)
		throw error
	}
}

export const genericPost = async (endpoint: string, data: any = {}): Promise<any> => {
	if (localStorage.getItem(LOCAL_STORAGE_KEYS.DEMO_MODE) === "true") {
		window.dispatchEvent(new Event("open-demo-modal"))
		return data
	}
	try {
		const response = await apiClient.post(`${import.meta.env.VITE_BACKEND_URL}/${endpoint}`, data)
		return response.data
	} catch (error: any) {
		console.error("Error:", error.response?.data?.error?.message || error.message)
		throw error
	}
}

// ---------------------------------------------------------------------------
// API — presigned URL (S3)
// ---------------------------------------------------------------------------
export const getPresignedUrl = async (
	entity: string,
	id: string | number,
	type: "upload" | "download",
	data?: Record<string, any>,
): Promise<{presignedUrl: string; s3Path?: string}> => {
	const endpoint = `${entity}/${id}/presigned-url-${type}`
	const payload = data || {}
	return await createItem(endpoint, payload)
}

// ---------------------------------------------------------------------------
// API — CRUD
// ---------------------------------------------------------------------------
export const createItem = async (entity: string, data: any): Promise<any> => {
	if (localStorage.getItem(LOCAL_STORAGE_KEYS.DEMO_MODE) === "true") {
		window.dispatchEvent(new Event("open-demo-modal"))
		return data
	}
	try {
		const response = await apiClient.post(`${import.meta.env.VITE_BACKEND_URL}/${entity}`, data)
		return response.data
	} catch (error: any) {
		console.error("Error:", error.response?.data?.error?.message || error.message)
		throw error
	}
}

export const updateItem = async (entity: string, id: string | number, data: any = {}): Promise<any> => {
	const response = await apiClient.put(`${import.meta.env.VITE_BACKEND_URL}/${entity}/${id}`, data)
	return response.data
}

export const deleteItem = async (entity: string, id: string | number): Promise<void> => {
	await apiClient.delete(`${import.meta.env.VITE_BACKEND_URL}/${entity}/${id}`)
}

// ---------------------------------------------------------------------------
// API — lista con filtri esatti
// ---------------------------------------------------------------------------
export const getListWithExactFilters = async (
	entity: string,
	exactFilters: Filters = {},
	otherFilters: Filters = {},
	pagination: Pagination = {},
	sortField: string | null = null,
): Promise<any[]> => {
	const url = new URL(`${import.meta.env.VITE_BACKEND_URL}/${entity}`)
	const filterObj: any = {where: {}}

	Object.entries(exactFilters).forEach(([key, value]) => {
		if (value !== undefined && value !== null && value !== "") {
			filterObj.where[key] = value
		}
	})

	Object.entries(otherFilters).forEach(([key, value]) => {
		if (value) {
			if (key.includes("Inequality")) {
				const fieldName = key.replace("Inequality", "")
				if (value.includes("neq")) {
					filterObj.where[fieldName] = {neq: null}
				} else if (value.includes("eq")) {
					filterObj.where[fieldName] = {eq: null}
				}
			} else if (key.includes("Id") && key !== "paramId") {
				filterObj.where[key] = value
			} else if (isBooleanField(key)) {
				filterObj.where[key] = value === "true"
			} else {
				filterObj.where[key] = {like: `%${value}%`, options: "i"}
			}
		}
	})

	if (pagination.limit) filterObj.limit = pagination.limit
	if (pagination.skip) filterObj.skip = pagination.skip
	if (sortField) filterObj.order = sortField

	url.searchParams.append("filter", JSON.stringify(filterObj))

	try {
		const response = await apiClient.get(url.toString())
		const data = response.data
		return data
	} catch (error: any) {
		console.error("Error fetching data:", error)
		throw error
	}
}

// ---------------------------------------------------------------------------
// API — GET generica con query string
// ---------------------------------------------------------------------------
export const getByQuery = async (path: string, params: Record<string, string | number | boolean>): Promise<any> => {
	const url = new URL(`${import.meta.env.VITE_BACKEND_URL}/${path}`)

	Object.entries(params).forEach(([key, value]) => {
		if (value !== undefined && value !== null) {
			url.searchParams.append(key, String(value).trim())
		}
	})

	try {
		const response = await apiClient.get(url.toString())
		const data = response.data
		return data
	} catch (error: any) {
		console.error("Error fetching data:", error)
		throw error
	}
}
