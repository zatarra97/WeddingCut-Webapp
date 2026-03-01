import { useState, useEffect, useCallback } from "react"
import { toast } from "react-toastify"
import { genericGet, genericPost } from "../../../services/api-utility"
import { LOCAL_STORAGE_KEYS } from "../../../constants"

interface CognitoUser {
	username: string
	email: string
	name?: string
	phone?: string
	enabled: boolean
	status: string
	createdAt?: string
	isAdmin: boolean
}

const STATUS_MAP: Record<string, string> = {
	CONFIRMED:    "Confermato",
	UNCONFIRMED:  "Non confermato",
	FORCE_CHANGE_PASSWORD: "Password da cambiare",
	RESET_REQUIRED: "Reset richiesto",
}

const AdminUsers = () => {
	const [users, setUsers] = useState<CognitoUser[]>([])
	const [loading, setLoading] = useState(true)
	const [emailFilter, setEmailFilter] = useState("")
	const [toggling, setToggling] = useState<string | null>(null)

	const selfEmail = localStorage.getItem(LOCAL_STORAGE_KEYS.USER_EMAIL) ?? ""

	const load = useCallback(() => {
		setLoading(true)
		const qs = emailFilter.trim() ? `?email=${encodeURIComponent(emailFilter.trim())}` : ""
		genericGet(`admin/users${qs}`)
			.then((data: CognitoUser[]) => setUsers(data))
			.catch(() => toast.error("Impossibile caricare gli utenti"))
			.finally(() => setLoading(false))
	}, [emailFilter])

	useEffect(() => { load() }, [load])

	const toggle = async (user: CognitoUser) => {
		if (toggling) return
		setToggling(user.username)
		const action = user.enabled ? "disable" : "enable"
		try {
			await genericPost(`admin/users/${encodeURIComponent(user.username)}/${action}`)
			setUsers(prev =>
				prev.map(u => u.username === user.username ? {...u, enabled: !u.enabled} : u)
			)
			toast.success(user.enabled ? "Utente disabilitato" : "Utente abilitato")
		} catch (err: any) {
			const msg = err?.response?.data?.error?.message ?? "Errore durante l'operazione"
			toast.error(msg)
		} finally {
			setToggling(null)
		}
	}

	return (
		<div className="min-h-[calc(100vh-64px)]">
			<nav className="sticky top-14 z-40 h-12 bg-gray-800 text-white shadow-sm">
				<div className="container mx-auto flex items-center px-4 md:px-6 pt-3">
					<span className="text-sm font-medium">Gestione utenti</span>
				</div>
			</nav>

			<div className="container mx-auto p-4 md:p-6">
				<h1 className="text-2xl font-bold text-gray-800 mb-6">Utenti</h1>

				{/* Filtro email */}
				<div className="flex gap-3 mb-6">
					<input
						type="text"
						placeholder="Filtra per email…"
						value={emailFilter}
						onChange={(e) => setEmailFilter(e.target.value)}
						className="block flex-1 max-w-sm rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 shadow-sm focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
					/>
					<button
						onClick={load}
						className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gray-100 text-gray-700 text-sm font-medium hover:bg-gray-200 transition-colors cursor-pointer"
					>
						<i className="fa-solid fa-magnifying-glass" />
						Cerca
					</button>
				</div>

				{loading ? (
					<div className="flex items-center gap-3 py-12 text-gray-500">
						<i className="fa-solid fa-spinner fa-spin text-purple-600 text-xl" />
						<span>Caricamento utenti…</span>
					</div>
				) : users.length === 0 ? (
					<div className="bg-white rounded-xl border border-gray-200 shadow-sm p-12 text-center">
						<i className="fa-solid fa-users text-4xl text-gray-300 mb-4 block" />
						<p className="text-gray-500 text-sm">Nessun utente trovato.</p>
					</div>
				) : (
					<div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
						<table className="min-w-full divide-y divide-gray-200">
							<thead className="bg-gray-50">
								<tr>
									<th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Utente</th>
									<th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Ruolo</th>
									<th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Stato Cognito</th>
									<th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Registrato il</th>
									<th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Accesso</th>
									<th className="px-4 py-3" />
								</tr>
							</thead>
							<tbody className="divide-y divide-gray-100">
								{users.map((user) => {
									const isSelf = user.email === selfEmail
									const isLoading = toggling === user.username
									return (
										<tr key={user.username} className={`${!user.enabled ? "bg-gray-50" : ""}`}>
											<td className="px-4 py-3">
												<div className="flex flex-col">
													<span className={`text-sm font-medium ${user.enabled ? "text-gray-900" : "text-gray-400 line-through"}`}>
														{user.email}
													</span>
													{user.name && (
														<span className="text-xs text-gray-400 mt-0.5">{user.name}</span>
													)}
													{user.phone && (
														<span className="text-xs text-gray-400">{user.phone}</span>
													)}
												</div>
											</td>
											<td className="px-4 py-3">
												{user.isAdmin ? (
													<span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-0.5 rounded-full bg-purple-100 text-purple-700">
														<i className="fa-solid fa-shield-halved text-[10px]" />
														Admin
													</span>
												) : (
													<span className="inline-flex items-center text-xs font-medium px-2.5 py-0.5 rounded-full bg-gray-100 text-gray-600">
														User
													</span>
												)}
											</td>
											<td className="px-4 py-3">
												<span className="text-xs text-gray-500">
													{STATUS_MAP[user.status] ?? user.status}
												</span>
											</td>
											<td className="px-4 py-3 text-sm text-gray-500">
												{user.createdAt
													? new Date(user.createdAt).toLocaleDateString("it-IT")
													: "—"}
											</td>
											<td className="px-4 py-3">
												<span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-0.5 rounded-full ${user.enabled ? "bg-green-100 text-green-700" : "bg-red-100 text-red-600"}`}>
													<span className={`w-1.5 h-1.5 rounded-full ${user.enabled ? "bg-green-500" : "bg-red-400"}`} />
													{user.enabled ? "Attivo" : "Disabilitato"}
												</span>
											</td>
											<td className="px-4 py-3 text-right">
												{!isSelf && !user.isAdmin && (
													<button
														onClick={() => toggle(user)}
														disabled={isLoading || !!toggling}
														className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
															user.enabled
																? "bg-red-50 text-red-600 border border-red-200 hover:bg-red-100"
																: "bg-green-50 text-green-700 border border-green-200 hover:bg-green-100"
														}`}
													>
														{isLoading
															? <i className="fa-solid fa-spinner fa-spin" />
															: user.enabled
																? <><i className="fa-solid fa-ban" /> Disabilita</>
																: <><i className="fa-solid fa-circle-check" /> Abilita</>
														}
													</button>
												)}
												{isSelf && (
													<span className="text-xs text-gray-400 italic">Tu</span>
												)}
											</td>
										</tr>
									)
								})}
							</tbody>
						</table>
					</div>
				)}

				<p className="mt-4 text-xs text-gray-400">
					<i className="fa-solid fa-circle-info mr-1" />
					Gli account Admin non possono essere disabilitati da questa interfaccia. Il filtro per email usa la corrispondenza per prefisso.
				</p>
			</div>
		</div>
	)
}

export default AdminUsers
