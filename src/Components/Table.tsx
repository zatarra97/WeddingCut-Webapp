import React from "react"
import Skeleton from "react-loading-skeleton"
import "react-loading-skeleton/dist/skeleton.css"

interface Column {
	key: string
	header: string
	type?: "image" | "text" | "note"
	width?: string
	render?: (value: any, item?: any) => React.ReactNode
	// Opzioni personalizzazione per tipo 'note'
	noteIcon?: string // es: 'fa-solid fa-circle-exclamation'
	noteColorClass?: string // es: 'text-amber-700 hover:text-amber-900'
}

interface Action {
	icon: string
	method: (item: any) => void
	visibility?: (item: any) => boolean
	tooltip: string
}

interface TableProps {
	columns: Column[]
	data: any[]
	actions?: Action[]
	loading?: boolean
}

const Table = ({ columns, data, actions, loading }: TableProps) => {
	const getValueByPath = (obj: any, path: string): any => {
		return path.split(".").reduce((acc, part) => acc && acc[part], obj)
	}

	if (loading) {
		return (
			<div className="relative overflow-hidden bg-white rounded-2xl shadow-lg border border-gray-100">
				<div className="overflow-x-auto">
					<table className="w-full text-sm text-left rtl:text-right text-gray-500">
						<thead className="text-xs text-gray-600 uppercase bg-gradient-to-r from-slate-200 to-slate-300 hidden md:table-header-group">
							<tr>
								{actions && (
									<th scope="col" className="px-6 py-4 font-semibold tracking-wide">
										<Skeleton width={100} height={20} />
									</th>
								)}
								{columns.map((column) => (
									<th key={column.key} scope="col" className="px-6 py-4 font-semibold tracking-wide">
										<Skeleton width={100} height={20} />
									</th>
								))}
							</tr>
						</thead>
						<tbody>
							{Array(30)
								.fill(null)
								.map((_, index) => (
									<tr
										key={index}
										className="bg-white border-b border-gray-100 odd:bg-white even:bg-gray-50/50 flex flex-col mb-4 md:table-row hover:bg-gray-50/30 transition-colors duration-200"
									>
										{actions && (
											<td className="px-6 py-3 flex gap-2 md:table-cell">
												<Skeleton height={32} width={32} />
											</td>
										)}
										{columns.map((column, colIndex) => (
											<td key={colIndex} className="px-6 py-3 flex justify-between md:table-cell">
												<span className="font-bold md:hidden">{column.header}:</span>
												<Skeleton height={20} width={100} />
											</td>
										))}
									</tr>
								))}
						</tbody>
					</table>
				</div>
			</div>
		)
	}

	if (data.length === 0) {
		return (
			<div className="relative overflow-hidden bg-white rounded-2xl shadow-lg border border-gray-100">
				<div className="overflow-x-auto">
					<table className="w-full text-sm text-left rtl:text-right text-gray-500">
						<thead className="text-xs text-gray-600 uppercase bg-gradient-to-r from-slate-200 to-slate-300 hidden md:table-header-group">
							<tr>
								{actions && (
									<th scope="col" className="px-6 py-5 font-semibold tracking-wide border-r border-gray-200">
										Azioni
									</th>
								)}
								{columns.map((column, index) => (
									<th
										key={column.key}
										scope="col"
										className={`px-6 py-5 font-semibold tracking-wide ${
											index < columns.length - 1 ? "border-r border-gray-200" : ""
										}`}
									>
										{column.header}
									</th>
								))}
							</tr>
						</thead>
						<tbody>
							<tr className="bg-white">
								<td colSpan={actions ? columns.length + 1 : columns.length} className="px-6 py-12 text-center">
									<div className="flex flex-col items-center justify-center text-gray-500">
										<i className="fa-solid fa-inbox text-4xl mb-3 text-gray-300"></i>
										<p className="text-lg font-medium text-gray-600">Nessun dato trovato</p>
										<p className="text-sm text-gray-400 mt-1">Inserisci un nuovo dato o prova a modificare i filtri di ricerca</p>
									</div>
								</td>
							</tr>
						</tbody>
					</table>
				</div>
			</div>
		)
	}

	return (
		<div className="relative overflow-hidden bg-white rounded-2xl shadow-lg border border-gray-100">
			{/* Versione desktop */}
			<div className="overflow-x-auto overflow-y-hidden hidden md:block">
				<table className="w-full text-sm text-left rtl:text-right text-gray-600">
					<thead className="text-xs text-gray-600 uppercase bg-gradient-to-r from-slate-200 to-slate-300">
						<tr>
							{actions && (
								<th scope="col" className="px-6 py-5 font-semibold tracking-wide border-r border-gray-200">
									Azioni
								</th>
							)}
							{columns.map((column, index) => (
								<th
									key={column.key}
									scope="col"
									className={`px-6 py-5 font-semibold tracking-wide ${
										index < columns.length - 1 ? "border-r border-gray-200" : ""
									}`}
									style={column.width ? { width: column.width } : undefined}
								>
									{column.header}
								</th>
							))}
						</tr>
					</thead>
					<tbody>
						{data.map((item, index) => (
							<tr
								key={index}
								className="border-b border-gray-100 odd:bg-white even:bg-gray-50/50 hover:bg-gradient-to-r hover:from-blue-50 hover:to-indigo-50 hover:shadow-sm hover:border-blue-200 transition-all duration-300 group"
							>
								{actions && (
									<td className="pl-4 py-2 border-r border-gray-200 group-hover:border-blue-200 transition-colors duration-300">
										<div className="flex gap-2">
											{actions.map((action) =>
												action.visibility && !action.visibility(item) ? null : (
													<button
														type="button"
														key={action.icon}
														onClick={() => action.method(item)}
														className="relative group/action w-8 h-8 rounded-lg bg-gradient-to-r from-gray-50 to-gray-100 hover:from-blue-100 hover:to-blue-200 border border-gray-200 hover:border-blue-300 transition-all duration-200 shadow-sm hover:shadow-md cursor-pointer flex items-center justify-center"
													>
														<i
															className={`fas ${action.icon} text-gray-600 group-hover/action:text-blue-700 text-sm`}
														></i>
														<div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-1.5 bg-gray-800 text-white text-xs rounded-lg opacity-0 group-hover/action:opacity-100 transition-opacity whitespace-nowrap z-[9999] pointer-events-none shadow-lg">
															{action.tooltip}
														</div>
													</button>
												)
											)}
										</div>
									</td>
								)}
								{columns.map((column, index) => {
									const value = getValueByPath(item, column.key)
									if (column.render) {
										return (
											<td
												key={column.key}
												className={`px-4 py-2 ${
													index < columns.length - 1 ? "border-r border-gray-200 group-hover:border-blue-200" : ""
												} transition-colors duration-300`}
												style={column.width ? { width: column.width } : undefined}
											>
												{column.render(value, item)}
											</td>
										)
									}

									if (column.type === "image") {
										return (
											<td
												key={column.key}
												className={`px-4 py-2 ${
													index < columns.length - 1 ? "border-r border-gray-200 group-hover:border-blue-200" : ""
												} transition-colors duration-300`}
												style={column.width ? { width: column.width } : undefined}
											>
												<img src={value} alt={value} className="w-10 h-10 rounded-full shadow-sm" />
											</td>
										)
									}

									if (column.type === "note") {
										const hasNote = typeof value === "string" ? value.trim().length > 0 : !!value
										const iconClass = column.noteIcon || "fa-solid fa-comment-dots"
										return (
											<td
												key={column.key}
												className={`px-4 py-2 ${
													index < columns.length - 1
														? "border-r border-gray-200 group-hover:border-blue-200 justify-items-center items-center"
														: ""
												} transition-colors duration-300`}
												style={column.width ? { width: column.width } : undefined}
											>
												{hasNote ? (
													<div className="relative group/note inline-flex items-center justify-center w-full">
														<span className="cursor-default transition-colors text-xl">
															<i className={iconClass}></i>
														</span>
														<div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-3 px-4 py-3 bg-linear-to-br from-gray-900 to-gray-800 text-white text-sm rounded-xl opacity-0 group-hover/note:opacity-100 group-hover/note:translate-y-0 translate-y-2 transition-all duration-300 whitespace-normal w-[500px] max-w-[90vw] z-[9999] pointer-events-none shadow-2xl border border-gray-700">
															<div className="whitespace-pre-wrap wrap-break-words leading-relaxed">
																{String(value)}
															</div>
															{/* Freccia */}
															<div className="absolute top-full left-1/2 transform -translate-x-1/2 -mt-1">
																<div className="w-3 h-3 bg-linear-to-br from-gray-900 to-gray-800 border-r border-b border-gray-700 transform rotate-45"></div>
															</div>
														</div>
													</div>
												) : (
													<span className="text-gray-400"></span>
												)}
											</td>
										)
									}

									return (
										<td
											key={column.key}
											className={`px-4 py-2 ${
												index < columns.length - 1 ? "border-r border-gray-200 group-hover:border-blue-200" : ""
											} transition-colors duration-300`}
											style={column.width ? { width: column.width } : undefined}
										>
											<span className="font-medium group-hover:text-blue-900 transition-colors duration-300">
												{value ?? "-"}
											</span>
										</td>
									)
								})}
							</tr>
						))}
					</tbody>
				</table>
			</div>

			{/* Versione mobile - con tabella che si restringe e azioni sempre visibili */}
			<div className="block md:hidden">
				<div className="overflow-x-auto overflow-y-hidden">
					<table className="w-full text-sm text-left rtl:text-right text-gray-600">
						<thead className="text-xs text-gray-600 uppercase bg-gradient-to-r from-slate-200 to-slate-300">
							<tr>
								{actions && (
									<th
										scope="col"
										className="sticky left-0 bg-gradient-to-r from-slate-200 to-slate-300 px-3 py-4 w-auto font-semibold tracking-wide border-r border-gray-200"
									></th>
								)}
								{columns.map((column, index) => (
									<th
										key={column.key}
										scope="col"
										className={`px-3 py-4 whitespace-nowrap font-semibold tracking-wide ${
											index < columns.length - 1 ? "border-r border-gray-200" : ""
										}`}
										style={column.width ? { width: column.width } : undefined}
									>
										{column.header}
									</th>
								))}
							</tr>
						</thead>
						<tbody>
							{data.map((item, index) => {
								const rowBgClass = index % 2 === 0 ? "bg-white" : "bg-gray-50/50"

								return (
									<tr
										key={index}
										className={`border-b border-gray-100 ${rowBgClass} hover:bg-gradient-to-r hover:from-blue-50 hover:to-indigo-50 hover:shadow-sm hover:border-blue-200 transition-all duration-300 group`}
									>
										{actions && (
											<td
												className={`sticky left-0 ${rowBgClass} group-hover:bg-gradient-to-r group-hover:from-blue-50 group-hover:to-indigo-50 px-3 py-2 border-r border-gray-200 group-hover:border-blue-200 transition-all duration-300`}
											>
												<div className="flex flex-row flex-wrap gap-1 justify-left">
													{actions.map((action) =>
														action.visibility && !action.visibility(item) ? null : (
															<button
																type="button"
																key={action.icon}
																onClick={() => action.method(item)}
																className="relative group/action w-7 h-7 rounded-lg bg-gradient-to-r from-gray-50 to-gray-100 hover:from-blue-100 hover:to-blue-200 border border-gray-200 hover:border-blue-300 transition-all duration-200 shadow-sm hover:shadow-md cursor-pointer flex items-center justify-center"
															>
																<i
																	className={`fas ${action.icon} text-gray-600 group-hover/action:text-blue-700 text-xs`}
																></i>
																<div
																	className="absolute top-full left-1/2 transform -translate-x-1/2 mt-1 px-2 py-1 bg-gray-800 text-white text-xs rounded-lg opacity-0 group-hover/action:opacity-100 transition-opacity whitespace-nowrap pointer-events-none shadow-lg"
																	style={{ zIndex: "999999", position: "fixed" }}
																>
																	{action.tooltip}
																</div>
															</button>
														)
													)}
												</div>
											</td>
										)}
										{columns.map((column, index) => {
											const value = getValueByPath(item, column.key)
											if (column.render) {
												return (
													<td
														key={column.key}
														className={`px-3 py-3 whitespace-nowrap ${
															index < columns.length - 1 ? "border-r border-gray-200 group-hover:border-blue-200" : ""
														} transition-colors duration-300`}
														style={column.width ? { width: column.width } : undefined}
													>
														{column.render(value, item)}
													</td>
												)
											}

											if (column.type === "image") {
												return (
													<td
														key={column.key}
														className={`px-3 py-3 whitespace-nowrap ${
															index < columns.length - 1 ? "border-r border-gray-200 group-hover:border-blue-200" : ""
														} transition-colors duration-300`}
														style={column.width ? { width: column.width } : undefined}
													>
														<img src={value} alt={value} className="w-12 h-12 rounded-full shadow-sm" />
													</td>
												)
											}

											if (column.type === "note") {
												const hasNote = typeof value === "string" ? value.trim().length > 0 : !!value
												const iconClass = column.noteIcon || "fa-solid fa-note-sticky"
												return (
													<td
														key={column.key}
														className={`px-2 py-2 whitespace-nowrap ${
															index < columns.length - 1 ? "border-r border-gray-200 group-hover:border-blue-200" : ""
														} transition-colors duration-300`}
														style={column.width ? { width: column.width } : undefined}
													>
														{hasNote ? (
															<div className="relative group/note inline-flex items-center justify-center">
																<span className="text-amber-500 hover:text-amber-600 cursor-default transition-colors text-xl">
																	<i className={iconClass}></i>
																</span>
																<div
																	className="absolute top-full left-1/2 transform -translate-x-1/2 mt-3 px-4 py-3 bg-gradient-to-br from-gray-900 to-gray-800 text-white text-sm rounded-xl opacity-0 group-hover/note:opacity-100 group-hover/note:-translate-y-0 translate-y-2 transition-all duration-300 whitespace-normal w-[500px] max-w-[90vw] pointer-events-none shadow-2xl border border-gray-700"
																	style={{ zIndex: "999999", position: "fixed" }}
																>
																	<div className="whitespace-pre-wrap break-words leading-relaxed">
																		{String(value)}
																	</div>
																	{/* Freccia */}
																	<div className="absolute bottom-full left-1/2 transform -translate-x-1/2 -mb-1">
																		<div className="w-3 h-3 bg-gradient-to-br from-gray-900 to-gray-800 border-l border-t border-gray-700 transform rotate-45"></div>
																	</div>
																</div>
															</div>
														) : (
															<span className="text-gray-400">-</span>
														)}
													</td>
												)
											}

											return (
												<td
													key={column.key}
													className={`px-3 py-3 whitespace-nowrap ${
														index < columns.length - 1 ? "border-r border-gray-200 group-hover:border-blue-200" : ""
													} transition-colors duration-300`}
													style={column.width ? { width: column.width } : undefined}
												>
													<span className="font-medium group-hover:text-blue-900 transition-colors duration-300">
														{value ?? "-"}
													</span>
												</td>
											)
										})}
									</tr>
								)
							})}
						</tbody>
					</table>
				</div>
			</div>
		</div>
	)
}

export default Table
