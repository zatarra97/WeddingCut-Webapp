import { useState, useEffect } from "react"
import { Link, useNavigate } from "react-router-dom"
import { toast } from "react-toastify"
import { genericGet } from "../../services/api-utility"

interface Order {
	publicId: string
	coupleName: string
	weddingDate: string
	desiredDeliveryDate?: string | null
	selectedServices: any[]
	totalPrice: number | null
	status: "pending" | "in_progress" | "completed" | "cancelled"
	createdAt: string
}

const TABS = [
	{ key: "all",      label: "Tutte",         statusFilter: null },
	{ key: "upcoming", label: "In attesa di approvazione", statusFilter: "pending" },
	{ key: "editing",  label: "In lavorazione", statusFilter: "in_progress" },
	{ key: "done",     label: "Completati",     statusFilter: "completed" },
] as const

type TabKey = (typeof TABS)[number]["key"]

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

function formatDate(iso: string): string {
	return new Date(iso).toLocaleDateString("it-IT", { day: "numeric", month: "long", year: "numeric" })
}

const Dashboard = () => {
	const navigate = useNavigate()
	const [activeTab, setActiveTab] = useState<TabKey>("all")
	const [orders, setOrders] = useState<Order[]>([])
	const [loading, setLoading] = useState(true)
	const [search, setSearch] = useState("")
	const [sortAsc, setSortAsc] = useState(true)

	useEffect(() => {
		genericGet("user/orders")
			.then((data: Order[]) => setOrders(data))
			.catch(() => toast.error("Impossibile caricare i progetti"))
			.finally(() => setLoading(false))
	}, [])

	const activeTabDef = TABS.find((t) => t.key === activeTab)!

	const filtered = orders
		.filter((o) => {
			if (activeTabDef.statusFilter && o.status !== activeTabDef.statusFilter) return false
			if (search.trim()) {
				const q = search.trim().toLowerCase()
				return o.coupleName.toLowerCase().includes(q)
			}
			return true
		})
		.sort((a, b) => {
			const da = new Date(a.weddingDate).getTime()
			const db = new Date(b.weddingDate).getTime()
			return sortAsc ? da - db : db - da
		})

	const countFor = (statusFilter: string | null) =>
		statusFilter ? orders.filter((o) => o.status === statusFilter).length : orders.length

	return (
		<div className="min-h-[calc(100vh-64px)]">
			{/* Tab bar */}
			<nav className="sticky top-28 z-30 h-12 bg-[#7c3aed] text-white shadow-sm">
				<div className="container mx-auto flex items-center gap-1 px-4 md:px-6 pt-2">
				{TABS.map((tab) => (
					<button
						key={tab.key}
						type="button"
						onClick={() => setActiveTab(tab.key)}
						className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors cursor-pointer ${
							activeTab === tab.key ? "bg-[#6d28d9] text-white" : "text-white/80 hover:bg-[#6d28d9]/50"
						}`}
					>
						{tab.label}
						{!loading && (
							<span className={`text-xs px-1.5 py-0.5 rounded-full font-semibold ${
								activeTab === tab.key ? "bg-white/20 text-white" : "bg-white/10 text-white/70"
							}`}>
								{countFor(tab.statusFilter)}
							</span>
						)}
					</button>
				))}
				</div>
			</nav>

			{/* Main content */}
			<div className="container mx-auto p-4 md:p-6 relative">
				{/* Watermark */}
				<div className="absolute bottom-4 right-4 text-gray-200/30 text-6xl font-bold select-none pointer-events-none">
					WeddingCut
				</div>

				{/* Title row + search */}
				<div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-6">
					<div>
						<h1 className="text-2xl md:text-3xl font-bold text-[#6d28d9]">Progetti</h1>
						<p className="text-base font-semibold text-[#7c3aed] mt-0.5">{activeTabDef.label}</p>
					</div>
					<div className="flex flex-col sm:items-end gap-2">
						<div className="relative w-full sm:w-56">
							<i className="fa-solid fa-search absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm" aria-hidden />
							<input
								type="text"
								value={search}
								onChange={(e) => setSearch(e.target.value)}
								placeholder="Cerca coppia"
								className="w-full pl-9 pr-3 py-2 rounded-lg border border-gray-300 bg-white text-gray-900 placeholder-gray-400 text-sm focus:outline-none focus:ring-2 focus:ring-[#7c3aed] focus:border-transparent"
							/>
						</div>
						<button
							type="button"
							onClick={() => setSortAsc((v) => !v)}
							className="flex items-center gap-2 text-sm font-medium text-[#7c3aed] hover:text-[#6d28d9] cursor-pointer"
						>
							Data del matrimonio
							<i className={`fa-solid fa-sort-${sortAsc ? "up" : "down"}`} aria-hidden />
						</button>
					</div>
				</div>

				{/* Cards */}
				<div className="space-y-3 max-w-4xl">
					{/* New project button */}
					<Link
						to="/user/orders/new"
						className="w-full flex items-center justify-center gap-2 p-5 rounded-xl border-2 border-dashed border-[#c4b5fd] text-[#7c3aed] font-medium hover:bg-[#f5f3ff] hover:border-[#8b5cf6] transition-colors"
					>
						<i className="fa-solid fa-plus" aria-hidden />
						Nuovo progetto
					</Link>

					{loading ? (
						<div className="flex items-center gap-3 py-10 text-gray-500">
							<i className="fa-solid fa-spinner fa-spin text-[#7c3aed] text-xl" />
							<span>Caricamento progetti…</span>
						</div>
					) : filtered.length === 0 ? (
						<div className="bg-white rounded-xl border border-gray-200 shadow-sm p-10 text-center">
							<i className="fa-solid fa-inbox text-4xl text-gray-300 mb-3 block" />
							<p className="text-gray-500 text-sm">
								{search ? "Nessun progetto corrisponde alla ricerca." : "Nessun progetto in questa sezione."}
							</p>
						</div>
					) : (
						filtered.map((order) => (
							<div
								key={order.publicId}
								onClick={() => navigate(`/user/orders/${order.publicId}`)}
								className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 md:p-5 cursor-pointer hover:border-[#c4b5fd] hover:shadow-md transition-all"
							>
								<div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
									{/* Left: names + dates */}
									<div className="flex-1 min-w-0">
										<div className="flex items-center gap-3 flex-wrap">
											<h2 className="text-base font-bold text-gray-900 truncate">{order.coupleName}</h2>
											<span className={`inline-flex items-center text-xs font-semibold px-2.5 py-0.5 rounded-full ${STATUS_CLASSES[order.status] ?? "bg-gray-100 text-gray-600"}`}>
												{STATUS_LABELS[order.status] ?? order.status}
											</span>
										</div>
										<div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1.5 text-sm text-gray-500">
											<span>
												<i className="fa-solid fa-ring text-[10px] mr-1.5 text-[#a78bfa]" aria-hidden />
												{formatDate(order.weddingDate)}
											</span>
											{order.desiredDeliveryDate && (
												<span>
													<i className="fa-solid fa-calendar-check text-[10px] mr-1.5 text-[#a78bfa]" aria-hidden />
													Consegna: {formatDate(order.desiredDeliveryDate)}
												</span>
											)}
										</div>
									</div>

									{/* Right: services + price */}
									<div className="flex items-center gap-3 shrink-0">
										<span className="inline-flex items-center gap-1 text-xs font-medium bg-[#ede9fe] text-[#7c3aed] px-2.5 py-1 rounded-full">
											<i className="fa-solid fa-film text-[10px]" aria-hidden />
											{Array.isArray(order.selectedServices) ? order.selectedServices.length : 0} servizi
										</span>
										<span className="text-sm font-semibold text-gray-700">
											{order.totalPrice != null
												? `€${Number(order.totalPrice).toFixed(2)}`
												: <em className="text-gray-400 font-normal text-xs">Da definire</em>
											}
										</span>
										<i className="fa-solid fa-chevron-right text-gray-300 text-xs" aria-hidden />
									</div>
								</div>
							</div>
						))
					)}
				</div>
			</div>
		</div>
	)
}

export default Dashboard
