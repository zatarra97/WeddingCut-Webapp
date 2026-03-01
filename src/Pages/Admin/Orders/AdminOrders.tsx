import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { toast } from "react-toastify"
import { genericGet } from "../../../services/api-utility"

interface Order {
	publicId: string
	userEmail: string
	coupleName: string
	weddingDate: string
	totalPrice: number | null
	status: "pending" | "in_progress" | "completed" | "cancelled"
	createdAt: string
}

type ViewMode = "table" | "lanes"

const STATUS_ORDER = ["pending", "in_progress", "completed", "cancelled"] as const

const STATUS_LABELS: Record<string, string> = {
	pending:     "In attesa",
	in_progress: "In lavorazione",
	completed:   "Completato",
	cancelled:   "Annullato",
}

const STATUS_BADGE: Record<string, string> = {
	pending:     "bg-yellow-100 text-yellow-800",
	in_progress: "bg-blue-100 text-blue-800",
	completed:   "bg-green-100 text-green-800",
	cancelled:   "bg-gray-100 text-gray-600",
}

const LANE_HEADER: Record<string, string> = {
	pending:     "bg-yellow-50 border-yellow-200 text-yellow-800",
	in_progress: "bg-blue-50 border-blue-200 text-blue-800",
	completed:   "bg-green-50 border-green-200 text-green-800",
	cancelled:   "bg-gray-50 border-gray-200 text-gray-600",
}

const LANE_ACCENT: Record<string, string> = {
	pending:     "border-l-yellow-400",
	in_progress: "border-l-blue-500",
	completed:   "border-l-green-500",
	cancelled:   "border-l-gray-400",
}

const LANE_DOT: Record<string, string> = {
	pending:     "bg-yellow-400",
	in_progress: "bg-blue-500",
	completed:   "bg-green-500",
	cancelled:   "bg-gray-400",
}

const STATUS_OPTIONS = [
	{ value: "", label: "Tutti gli stati" },
	{ value: "pending", label: "In attesa" },
	{ value: "in_progress", label: "In lavorazione" },
	{ value: "completed", label: "Completato" },
	{ value: "cancelled", label: "Annullato" },
]

const AdminOrders = () => {
	const navigate = useNavigate()
	const [orders, setOrders] = useState<Order[]>([])
	const [loading, setLoading] = useState(true)
	const [statusFilter, setStatusFilter] = useState("")
	const [emailSearch, setEmailSearch] = useState("")
	const [view, setView] = useState<ViewMode>("table")

	const loadOrders = () => {
		setLoading(true)
		const params = new URLSearchParams()
		// in lanes mode all statuses are always visible — ignore status filter
		if (view === "table" && statusFilter) params.append("status", statusFilter)
		if (emailSearch.trim()) params.append("userEmail", emailSearch.trim())
		const qs = params.toString()
		genericGet(`admin/orders${qs ? `?${qs}` : ""}`)
			.then((data: Order[]) => setOrders(data))
			.catch(() => toast.error("Impossibile caricare gli ordini"))
			.finally(() => setLoading(false))
	}

	useEffect(() => {
		loadOrders()
	}, [statusFilter, emailSearch, view])

	// ── Table view ────────────────────────────────────────────────────────────
	const TableContent = () => (
		orders.length === 0 ? (
			<div className="bg-white rounded-xl border border-gray-200 shadow-sm p-12 text-center">
				<i className="fa-solid fa-inbox text-4xl text-gray-300 mb-4 block" />
				<p className="text-gray-500 text-sm">Nessun ordine trovato.</p>
			</div>
		) : (
			<div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
				<table className="min-w-full divide-y divide-gray-200">
					<thead className="bg-gray-50">
						<tr>
							<th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">ID</th>
							<th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Email utente</th>
							<th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Coppia</th>
							<th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Matrimonio</th>
							<th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Totale</th>
							<th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Stato</th>
							<th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Creato</th>
						</tr>
					</thead>
					<tbody className="divide-y divide-gray-100">
						{orders.map((order) => (
							<tr
								key={order.publicId}
								onClick={() => navigate(`/admin/orders/${order.publicId}`)}
								className="hover:bg-gray-50 cursor-pointer transition-colors"
							>
								<td className="px-4 py-3 text-xs font-mono text-gray-500">{order.publicId.slice(0, 8)}…</td>
								<td className="px-4 py-3 text-sm text-gray-700">{order.userEmail}</td>
								<td className="px-4 py-3 font-medium text-gray-900 text-sm">{order.coupleName}</td>
								<td className="px-4 py-3 text-gray-600 text-sm">{order.weddingDate}</td>
								<td className="px-4 py-3 text-gray-700 text-sm font-medium">
									{order.totalPrice != null ? `€${Number(order.totalPrice).toFixed(2)}` : <em className="text-gray-400 font-normal">Su richiesta</em>}
								</td>
								<td className="px-4 py-3">
									<span className={`inline-flex items-center text-xs font-semibold px-2.5 py-0.5 rounded-full ${STATUS_BADGE[order.status] ?? "bg-gray-100 text-gray-600"}`}>
										{STATUS_LABELS[order.status] ?? order.status}
									</span>
								</td>
								<td className="px-4 py-3 text-gray-500 text-sm">
									{new Date(order.createdAt).toLocaleDateString("it-IT")}
								</td>
							</tr>
						))}
					</tbody>
				</table>
			</div>
		)
	)

	// ── Lanes (Kanban) view ───────────────────────────────────────────────────
	const LanesContent = () => (
		<div className="flex gap-4 overflow-x-auto pb-2 items-start">
			{STATUS_ORDER.map((status) => {
				const laneOrders = orders.filter((o) => o.status === status)
				return (
					<div key={status} className="flex-none w-72">
						{/* Lane header */}
						<div className={`flex items-center gap-2 px-3 py-2.5 rounded-t-xl border ${LANE_HEADER[status]}`}>
							<span className={`w-2 h-2 rounded-full shrink-0 ${LANE_DOT[status]}`} />
							<span className="font-semibold text-sm">{STATUS_LABELS[status]}</span>
							<span className="ml-auto flex items-center justify-center min-w-[22px] h-5 rounded-full bg-black/10 text-xs font-bold px-1.5">
								{laneOrders.length}
							</span>
						</div>

						{/* Lane body */}
						<div className="border border-t-0 border-gray-200 rounded-b-xl bg-gray-50/60 p-2 space-y-2 min-h-[100px]">
							{laneOrders.length === 0 ? (
								<p className="text-center text-xs text-gray-400 py-6 italic">Nessun ordine</p>
							) : (
								laneOrders.map((order) => (
									<div
										key={order.publicId}
										onClick={() => navigate(`/admin/orders/${order.publicId}`)}
										className={`bg-white rounded-lg border border-gray-200 border-l-4 ${LANE_ACCENT[order.status]} p-3 cursor-pointer hover:shadow-md hover:border-gray-300 transition-all`}
									>
										<p className="font-semibold text-gray-900 text-sm truncate">{order.coupleName}</p>
										<p className="text-xs text-gray-500 mt-0.5 truncate">{order.userEmail}</p>
										<div className="flex items-center justify-between mt-2.5 text-xs text-gray-500">
											<span className="flex items-center gap-1">
												<i className="fa-solid fa-calendar-alt text-gray-400" aria-hidden />
												{order.weddingDate}
											</span>
											<span className="font-semibold text-gray-700">
												{order.totalPrice != null
													? `€${Number(order.totalPrice).toFixed(2)}`
													: <em className="font-normal text-gray-400">—</em>}
											</span>
										</div>
										<p className="text-[10px] text-gray-400 mt-1.5">
											{new Date(order.createdAt).toLocaleDateString("it-IT")}
										</p>
									</div>
								))
							)}
						</div>
					</div>
				)
			})}
		</div>
	)

	return (
		<div className="min-h-full">
			<div className={view === "table" ? "container mx-auto p-4 md:p-6" : "p-4 md:p-6"}>

				{/* Title row + view toggle */}
				<div className="flex items-center gap-4 mb-6">
					<h1 className="text-2xl font-bold text-gray-800 flex-1">Ordini</h1>
					<div className="flex items-center bg-white rounded-lg border border-gray-200 p-1 gap-0.5 shadow-sm">
						<button
							onClick={() => setView("table")}
							title="Vista tabella"
							className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors cursor-pointer ${
								view === "table"
									? "bg-violet-600 text-white shadow-sm"
									: "text-gray-500 hover:text-gray-700 hover:bg-gray-50"
							}`}
						>
							<i className="fa-solid fa-table-list" aria-hidden />
							<span className="hidden sm:inline">Tabella</span>
						</button>
						<button
							onClick={() => setView("lanes")}
							title="Vista Kanban"
							className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors cursor-pointer ${
								view === "lanes"
									? "bg-violet-600 text-white shadow-sm"
									: "text-gray-500 hover:text-gray-700 hover:bg-gray-50"
							}`}
						>
							<i className="fa-solid fa-table-columns" aria-hidden />
							<span className="hidden sm:inline">Kanban</span>
						</button>
					</div>
				</div>

				{/* Filtri */}
				<div className="flex flex-col sm:flex-row gap-3 mb-6">
					{view === "table" && (
						<select
							value={statusFilter}
							onChange={(e) => setStatusFilter(e.target.value)}
							className="block rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 shadow-sm focus:border-violet-500 focus:ring-1 focus:ring-violet-500"
						>
							{STATUS_OPTIONS.map((o) => (
								<option key={o.value} value={o.value}>{o.label}</option>
							))}
						</select>
					)}
					<input
						type="text"
						placeholder="Cerca per email…"
						value={emailSearch}
						onChange={(e) => setEmailSearch(e.target.value)}
						className="block flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 shadow-sm focus:border-violet-500 focus:ring-1 focus:ring-violet-500"
					/>
				</div>

				{/* Content */}
				{loading ? (
					<div className="flex items-center gap-3 py-12 text-gray-500">
						<i className="fa-solid fa-spinner fa-spin text-violet-600 text-xl" />
						<span>Caricamento ordini…</span>
					</div>
				) : view === "table" ? (
					<TableContent />
				) : (
					<LanesContent />
				)}
			</div>
		</div>
	)
}

export default AdminOrders
