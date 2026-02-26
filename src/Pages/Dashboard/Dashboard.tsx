import { useState, useEffect } from "react"
import { Link } from "react-router-dom"
import { genericGet } from "../../services/api-utility"

const TABS = [
	{ key: "all", label: "Tutte", count: 1 },
	{ key: "upcoming", label: "Da ordinare", count: 1 },
	{ key: "editing", label: "In lavorazione", count: 0 },
	{ key: "done", label: "Completati", count: 0 },
] as const

type TabKey = (typeof TABS)[number]["key"]

const PROJECTS_STATIC = [
	{
		id: "1",
		name: "Pietro Gio ed Emma",
		weddingDate: "11 Feb 2027",
		service: "Video Editing",
	},
]

const Dashboard = () => {
	const [activeTab, setActiveTab] = useState<TabKey>("all")
	const activeLabel = TABS.find((t) => t.key === activeTab)?.label ?? "All"
	const [apiStatus, setApiStatus] = useState<"idle" | "loading" | "ok" | "error">("idle")

	useEffect(() => {
		setApiStatus("loading")
		genericGet("dashboard")
			.then(() => setApiStatus("ok"))
			.catch(() => setApiStatus("error"))
	}, [])

	return (
		<div className="min-h-[calc(100vh-64px)]">
			{/* Tab bar */}
			<nav className="sticky top-14 z-40 h-12 bg-purple-600 text-white shadow-sm">
				<div className="container mx-auto flex items-center gap-1 px-4 md:px-6 pt-2">
				{TABS.map((tab) => (
					<button
						key={tab.key}
						type="button"
						onClick={() => setActiveTab(tab.key)}
						className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors cursor-pointer ${
							activeTab === tab.key ? "bg-purple-700 text-white" : "text-purple-100 hover:bg-purple-500/50"
						}`}
					>
						{tab.label}
						<span className="bg-white/20 text-white text-xs font-semibold px-1.5 py-0.5 rounded">
							{tab.count}
						</span>
					</button>
				))}
				</div>
			</nav>

			{/* Main content */}
			<div className="container mx-auto p-4 md:p-6 relative">
				{/* Watermark-style logo in corner (optional, subtle) */}
				<div className="absolute bottom-4 right-4 text-gray-200/30 text-6xl font-bold select-none pointer-events-none">
					WeddingCut
				</div>

				{/* Title row + search */}
				<div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-6">
					<div>
						<h1 className="text-2xl md:text-3xl font-bold text-purple-800">Progetti</h1>
						<p className="text-base font-semibold text-purple-700 mt-0.5">{activeLabel}</p>
					</div>
					<div className="flex flex-col sm:items-end gap-2">
						<div className="relative w-full sm:w-56">
							<i className="fa-solid fa-search absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm" aria-hidden />
							<input
								type="text"
								placeholder="Cerca"
								className="w-full pl-9 pr-3 py-2 rounded-lg border border-gray-300 bg-white text-gray-900 placeholder-gray-400 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
							/>
						</div>
						<button
							type="button"
							className="flex items-center gap-2 text-sm font-medium text-purple-700 hover:text-purple-800 cursor-pointer"
						>
							Data del matrimonio
							<i className="fa-solid fa-sort" aria-hidden />
						</button>
					</div>
				</div>

				{/* Banner stato API — solo per test */}
				{apiStatus !== "idle" && (
					<div className={`mb-4 flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium max-w-4xl ${
						apiStatus === "loading" ? "bg-gray-100 text-gray-600" :
						apiStatus === "ok"      ? "bg-green-50 text-green-700 border border-green-200" :
						                          "bg-red-50 text-red-700 border border-red-200"
					}`}>
						{apiStatus === "loading" && <i className="fa-solid fa-spinner fa-spin" />}
						{apiStatus === "ok"      && <i className="fa-solid fa-circle-check" />}
						{apiStatus === "error"   && <i className="fa-solid fa-circle-xmark" />}
						{apiStatus === "loading" && "Chiamata a GET /dashboard in corso…"}
						{apiStatus === "ok"      && "GET /dashboard → { success: true } ✓"}
						{apiStatus === "error"   && "GET /dashboard → errore (controlla console e backend)"}
					</div>
				)}

				{/* Project cards */}
				<div className="space-y-3 max-w-4xl">
					{PROJECTS_STATIC.map((project) => (
						<div
							key={project.id}
							className="flex flex-wrap items-center gap-4 p-4 bg-white rounded-xl border border-gray-200 shadow-sm"
						>
							<div className="flex-1 min-w-0">
								<h2 className="font-bold text-gray-900 truncate">{project.name}</h2>
								<div className="flex flex-wrap items-center gap-4 mt-1 text-sm text-gray-600">
									<span className="flex items-center gap-1.5">
										<i className="fa-solid fa-calendar-alt text-gray-400" aria-hidden />
										{project.weddingDate}
									</span>
									<span className="flex items-center gap-1.5">
										<i className="fa-solid fa-video text-gray-400" aria-hidden />
										{project.service}
									</span>
								</div>
							</div>
							<div className="flex items-center gap-2">
								<button
									type="button"
									className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-100 text-purple-700 text-sm font-medium hover:bg-gray-200 transition-colors cursor-pointer"
								>
									<i className="fa-solid fa-eye" aria-hidden />
									Dettagli
								</button>
								<button
									type="button"
									className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-purple-700 text-white text-sm font-medium hover:bg-purple-800 transition-colors cursor-pointer"
								>
									Ordina ora
								</button>
							</div>
						</div>
					))}

					{/* Add project link */}
					<Link
						to="/orders/new"
						className="w-full flex items-center justify-center gap-2 p-5 rounded-xl border-2 border-dashed border-purple-300 text-purple-700 font-medium hover:bg-purple-50 hover:border-purple-400 transition-colors"
					>
						<i className="fa-solid fa-plus" aria-hidden />
						Nuovo progetto
					</Link>
				</div>
			</div>
		</div>
	)
}

export default Dashboard
