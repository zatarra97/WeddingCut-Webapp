import { useState } from "react"
import Input from "../../Components/Input"
import Textarea from "../../Components/Textarea"
import DateTimePicker from "../../Components/DateTimePicker"

const NewOrder = () => {
	const [coupleNames, setCoupleNames] = useState("")
	const [weddingDate, setWeddingDate] = useState("")
	const [teaser, setTeaser] = useState(false)
	const [highlight, setHighlight] = useState(true)
	const [highlightMinutes, setHighlightMinutes] = useState(6)
	const [fullDoc, setFullDoc] = useState(true)
	const [fullDocMinutes, setFullDocMinutes] = useState(40)
	const [nonChronological, setNonChronological] = useState(false)
	const [ceremonyEdit, setCeremonyEdit] = useState(false)
	const [speeches, setSpeeches] = useState(false)
	const [reception, setReception] = useState(false)
	const [customFormat, setCustomFormat] = useState(true)
	const [description, setDescription] = useState("")

	// Dati statici per il riepilogo (poi da API/logica reale)
	const priceTeaser = 195
	const priceHighlight = 595
	const priceFullDoc = 650
	const subtotal =
		(teaser ? priceTeaser : 0) + (highlight ? priceHighlight : 0) + (fullDoc ? priceFullDoc : 0)
	const totalDue = subtotal

	return (
		<div className="min-h-[calc(100vh-3.5rem)] bg-gray-100 relative">
			<div className="container mx-auto px-4 py-6 md:py-8 relative">
				<div className="flex flex-col lg:flex-row gap-8">
					{/* Colonna sinistra: modulo */}
					<section className="flex-1 max-w-4xl">
						<div className="rounded-xl border border-gray-200 bg-white shadow-sm p-6 md:p-8 space-y-8">
						<h1 className="text-2xl font-bold text-purple-800">Nuovo progetto</h1>

						{/* Nomi della coppia + Data del matrimonio (stessa riga, data = 1/4) */}
						<div className="grid grid-cols-1 sm:grid-cols-4 gap-4 items-end">
							<div className="sm:col-span-3">
								<Input
									name="coupleNames"
									type="text"
									label="Nomi della coppia"
									value={coupleNames}
									onChange={(e) => setCoupleNames(e.target.value)}
									placeholder="Ad es. «Mario e Laura». Sarà il nome del progetto."
								/>
							</div>
							<div className="sm:col-span-1">
								<DateTimePicker
									label="Data del matrimonio"
									value={weddingDate || null}
									onChange={(date) => setWeddingDate(date ?? "")}
								/>
							</div>
						</div>

						{/* Formati video */}
						<div className="space-y-6">
							<div>
								<h2 className="text-lg font-semibold text-gray-900">Formati video</h2>
								<p className="text-sm text-gray-500 mt-0.5">Quali video vuoi far editare in questo progetto?</p>
							</div>

							{/* Anteprima (Teaser) */}
							<div className="flex flex-wrap items-start gap-2">
								<label className="inline-flex items-center gap-2 cursor-pointer">
									<input
										type="checkbox"
										checked={teaser}
										onChange={(e) => setTeaser(e.target.checked)}
										className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
									/>
									<span className="font-medium text-gray-800">Anteprima</span>
								</label>
								<button type="button" className="text-sm text-purple-600 hover:text-purple-800 cursor-pointer">
									Aggiungi un&apos;altra anteprima
								</button>
							</div>

							{/* Momenti salienti (Highlight) */}
							<div className="space-y-2">
								<label className="inline-flex items-center gap-2 cursor-pointer">
									<input
										type="checkbox"
										checked={highlight}
										onChange={(e) => setHighlight(e.target.checked)}
										className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
									/>
									<span className="font-medium text-gray-800">Momenti salienti ({highlightMinutes} min)</span>
								</label>
								<div className="pl-6">
									<input
										type="range"
										min={2}
										max={19}
										value={highlightMinutes}
										onChange={(e) => setHighlightMinutes(Number(e.target.value))}
										className="w-full h-2 rounded-lg appearance-none bg-gray-200 accent-purple-600"
									/>
									<div className="flex justify-between text-xs text-gray-500 mt-1">
										<span>2</span>
										<span>19 min</span>
									</div>
								</div>
								<button type="button" className="text-sm text-purple-600 hover:text-purple-800 cursor-pointer pl-6 block">
									Aggiungi un altro momento saliente
								</button>
							</div>

							{/* Documentario completo */}
							<div className="space-y-2">
								<label className="inline-flex items-center gap-2 cursor-pointer">
									<input
										type="checkbox"
										checked={fullDoc}
										onChange={(e) => setFullDoc(e.target.checked)}
										className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
									/>
									<span className="font-medium text-gray-800">Documentario completo ({fullDocMinutes} min)</span>
								</label>
								<div className="pl-6">
									<label className="inline-flex items-center gap-2 cursor-pointer">
										<input
											type="checkbox"
											checked={nonChronological}
											onChange={(e) => setNonChronological(e.target.checked)}
											className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
										/>
										<span className="text-sm text-gray-700">Documentario non cronologico (+€195)</span>
									</label>
								</div>
								<div className="pl-6">
									<input
										type="range"
										min={20}
										max={120}
										value={fullDocMinutes}
										onChange={(e) => setFullDocMinutes(Number(e.target.value))}
										className="w-full h-2 rounded-lg appearance-none bg-gray-200 accent-purple-600"
									/>
									<div className="flex justify-between text-xs text-gray-500 mt-1">
										<span>20</span>
										<span>120 min</span>
									</div>
								</div>
							</div>

							{/* Montaggi aggiuntivi */}
							<div className="space-y-2 pl-0">
								<label className="inline-flex items-center gap-2 cursor-pointer">
									<input
										type="checkbox"
										checked={ceremonyEdit}
										onChange={(e) => setCeremonyEdit(e.target.checked)}
										className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
									/>
									<span className="text-gray-800">Montaggio cerimonia</span>
								</label>
								<br />
								<label className="inline-flex items-center gap-2 cursor-pointer">
									<input
										type="checkbox"
										checked={speeches}
										onChange={(e) => setSpeeches(e.target.checked)}
										className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
									/>
									<span className="text-gray-800">Discorsi</span>
								</label>
								<br />
								<label className="inline-flex items-center gap-2 cursor-pointer">
									<input
										type="checkbox"
										checked={reception}
										onChange={(e) => setReception(e.target.checked)}
										className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
									/>
									<span className="text-gray-800">Ricevimento</span>
								</label>
							</div>

							{/* Formato personalizzato */}
							<label className="inline-flex items-center gap-2 cursor-pointer">
								<input
									type="checkbox"
									checked={customFormat}
									onChange={(e) => setCustomFormat(e.target.checked)}
									className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
								/>
								<span className="font-medium text-gray-800">Formato personalizzato</span>
							</label>
						</div>

						{/* Descrizione */}
						<Textarea
							name="description"
							label="Descrizione"
							rows={5}
							value={description}
							onChange={(e) => setDescription(e.target.value)}
							placeholder="Descrivi il video o altre specifiche qui sotto. Lo esamineremo e ti invieremo un preventivo personalizzato."
						/>
						</div>
					</section>

					{/* Colonna destra: riepilogo prezzo */}
					<aside className="lg:w-80 shrink-0">
						<div className="lg:sticky lg:top-24 rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
							<div className="bg-purple-100 px-4 py-3 border-b border-purple-200">
								<h2 className="text-lg font-semibold text-purple-800">Prezzo progetto</h2>
							</div>
							<div className="p-4 space-y-3">
								{teaser && (
									<div className="flex justify-between text-sm">
										<span className="text-gray-700">Anteprima (orizzontale)</span>
										<span className="font-medium text-gray-900">€{priceTeaser.toFixed(2)}</span>
									</div>
								)}
								{highlight && (
									<div className="flex justify-between text-sm">
										<span className="text-gray-700">Momenti salienti ({highlightMinutes} min)</span>
										<span className="font-medium text-gray-900">€{priceHighlight.toFixed(2)}</span>
									</div>
								)}
								{fullDoc && (
									<div className="flex justify-between text-sm">
										<span className="text-gray-700">Documentario completo ({fullDocMinutes} min)</span>
										<span className="font-medium text-gray-900">€{priceFullDoc.toFixed(2)}</span>
									</div>
								)}
								{customFormat && (
									<div className="flex justify-between text-sm">
										<span className="text-gray-700">Formato personalizzato</span>
										<span className="text-gray-500 italic">In revisione</span>
									</div>
								)}
								<div className="border-t border-gray-200 pt-3 flex justify-between text-sm font-medium">
									<span className="text-gray-700">Subtotale</span>
									<span className="text-gray-900">€{subtotal.toFixed(2)}</span>
								</div>
								<div className="border-t border-gray-200 pt-3 flex justify-between font-semibold text-base">
									<span className="text-gray-800">Totale dovuto *</span>
									<span className="text-purple-700">€{totalDue.toFixed(2)}</span>
								</div>
								<p className="text-xs text-gray-500 pt-1">
									* Il prezzo totale non include i formati personalizzati. Esamineremo i requisiti e ti invieremo una fattura separata.
								</p>
							</div>
						</div>
					</aside>
				</div>

				{/* Watermark */}
				<div className="absolute bottom-4 right-4 text-gray-200/30 text-5xl font-bold select-none pointer-events-none hidden md:block">
					WeddingCut
				</div>
			</div>
		</div>
	)
}

export default NewOrder
