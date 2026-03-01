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

const STATUS_LABELS: Record<string, string> = {
	pending:     "In attesa",
	in_progress: "In lavorazione",
	completed:   "Completato",
	cancelled:   "Annullato",
}

const STATUS_CLASSES: Record<string, string> = {
	pending:     "bg-yellow-100 text-yellow-800",
	in_progress: "bg-blue-100 text-blue-800",
	completed:   "bg-green-100 text-green-800",
	cancelled:   "bg-gray-100 text-gray-600",
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

	const loadOrders = () => {
		setLoading(true)
		const params = new URLSearchParams()
		if (statusFilter) params.append("status", statusFilter)
		if (emailSearch.trim()) params.append("userEmail", emailSearch.trim())
		const qs = params.toString()
		genericGet(`admin/orders${qs ? `?${qs}` : ""}`)
			.then((data: Order[]) => setOrders(data))
			.catch(() => toast.error("Impossibile caricare gli ordini"))
			.finally(() => setLoading(false))
	}

	useEffect(() => {
		loadOrders()
	}, [statusFilter, emailSearch])

	return (
		<div className="min-h-[calc(100vh-64px)]">
			<nav className="sticky top-14 z-40 h-12 bg-gray-800 text-white shadow-sm">
				<div className="container mx-auto flex items-center px-4 md:px-6 pt-3">
					<span className="text-sm font-medium">Gestione ordini</span>
				</div>
			</nav>

			<div className="container mx-auto p-4 md:p-6">
				<h1 className="text-2xl font-bold text-gray-800 mb-6">Ordini</h1>

				{/* Filtri */}
				<div className="flex flex-col sm:flex-row gap-3 mb-6">
					<select
						value={statusFilter}
						onChange={(e) => setStatusFilter(e.target.value)}
						className="block rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 shadow-sm focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
					>
						{STATUS_OPTIONS.map((o) => (
							<option key={o.value} value={o.value}>{o.label}</option>
						))}
					</select>
					<input
						type="text"
						placeholder="Cerca per email…"
						value={emailSearch}
						onChange={(e) => setEmailSearch(e.target.value)}
						className="block flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 shadow-sm focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
					/>
				</div>

				{loading ? (
					<div className="flex items-center gap-3 py-12 text-gray-500">
						<i className="fa-solid fa-spinner fa-spin text-purple-600 text-xl" />
						<span>Caricamento ordini…</span>
					</div>
				) : orders.length === 0 ? (
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
											<span className={`inline-flex items-center text-xs font-semibold px-2.5 py-0.5 rounded-full ${STATUS_CLASSES[order.status] ?? "bg-gray-100 text-gray-600"}`}>
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
				)}
			</div>
		</div>
	)
}

export default AdminOrders
