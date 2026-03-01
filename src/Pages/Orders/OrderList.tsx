import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { toast } from "react-toastify"
import { genericGet } from "../../services/api-utility"

interface Order {
	publicId: string
	coupleName: string
	weddingDate: string
	selectedServices: any[]
	totalPrice: number | null
	status: "pending" | "in_progress" | "completed" | "cancelled"
	createdAt: string
}

const STATUS_LABELS: Record<string, string> = {
	pending: "In attesa",
	in_progress: "In lavorazione",
	completed: "Completato",
	cancelled: "Annullato",
}

const STATUS_CLASSES: Record<string, string> = {
	pending:     "bg-yellow-100 text-yellow-800",
	in_progress: "bg-blue-100 text-blue-800",
	completed:   "bg-green-100 text-green-800",
	cancelled:   "bg-gray-100 text-gray-600",
}

const OrderList = () => {
	const navigate = useNavigate()
	const [orders, setOrders] = useState<Order[]>([])
	const [loading, setLoading] = useState(true)

	useEffect(() => {
		genericGet("user/orders")
			.then((data: Order[]) => setOrders(data))
			.catch(() => toast.error("Impossibile caricare gli ordini"))
			.finally(() => setLoading(false))
	}, [])

	return (
		<div className="min-h-[calc(100vh-3.5rem)] bg-gray-100">
			<div className="container mx-auto px-4 py-6 md:py-8">
				<div className="flex items-center justify-between mb-6">
					<h1 className="text-2xl font-bold text-gray-800">I miei ordini</h1>
					<button
						onClick={() => navigate("/user/orders/new")}
						className="flex items-center gap-2 px-4 py-2 rounded-lg bg-purple-700 text-white text-sm font-medium hover:bg-purple-800 transition-colors cursor-pointer"
					>
						<i className="fa-solid fa-plus" />
						Nuovo ordine
					</button>
				</div>

				{loading ? (
					<div className="flex items-center gap-3 py-12 text-gray-500">
						<i className="fa-solid fa-spinner fa-spin text-purple-600 text-xl" />
						<span>Caricamento ordini…</span>
					</div>
				) : orders.length === 0 ? (
					<div className="bg-white rounded-xl border border-gray-200 shadow-sm p-12 text-center">
						<i className="fa-solid fa-inbox text-4xl text-gray-300 mb-4 block" />
						<p className="text-gray-500 text-sm">Nessun ordine ancora. Clicca "Nuovo ordine" per iniziare.</p>
					</div>
				) : (
					<div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
						<table className="min-w-full divide-y divide-gray-200">
							<thead className="bg-gray-50">
								<tr>
									<th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Coppia</th>
									<th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Matrimonio</th>
									<th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Servizi</th>
									<th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Totale</th>
									<th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Stato</th>
									<th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Creato</th>
								</tr>
							</thead>
							<tbody className="divide-y divide-gray-100">
								{orders.map((order) => (
									<tr
										key={order.publicId}
										onClick={() => navigate(`/user/orders/${order.publicId}`)}
										className="hover:bg-gray-50 cursor-pointer transition-colors"
									>
										<td className="px-4 py-3 font-medium text-gray-900 text-sm">{order.coupleName}</td>
										<td className="px-4 py-3 text-gray-600 text-sm">{order.weddingDate}</td>
										<td className="px-4 py-3">
											<span className="inline-flex items-center gap-1 text-xs font-medium bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">
												<i className="fa-solid fa-film text-[10px]" />
												{Array.isArray(order.selectedServices) ? order.selectedServices.length : 0} servizi
											</span>
										</td>
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

export default OrderList
