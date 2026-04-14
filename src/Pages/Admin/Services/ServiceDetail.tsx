import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useForm, useFieldArray, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'react-toastify'
import Input from '../../../Components/Input'
import Textarea from '../../../Components/Textarea'
import Select from '../../../Components/Select'
import FormSection from '../../../Components/FormSection'
import { getItem, createItem, updateItem } from '../../../services/api-utility'
import { serviceSchema, type ServiceFormData, type Service } from './serviceSchema'

const CATEGORY_OPTIONS = [
	{ value: 'main', label: 'Servizio principale' },
	{ value: 'extra', label: 'Extra' },
	{ value: 'delivery', label: 'Consegna' },
]

const PRICING_TYPE_OPTIONS = [
	{ value: 'fixed', label: 'Prezzo fisso' },
	{ value: 'tiered', label: 'A fasce' },
	{ value: 'percentage', label: 'Percentuale su totale' },
]

const DISCOUNT_ROLE_OPTIONS = [
	{ value: '', label: 'Nessuno (non conta per sconti)' },
	{ value: 'teaser', label: 'Teaser' },
	{ value: 'highlight', label: 'Highlight' },
	{ value: 'weddingfilm', label: 'WeddingFilm' },
	{ value: 'package', label: 'Pacchetto' },
]

const DEFAULT_VALUES: ServiceFormData = {
	name: '',
	description: '',
	durationDescription: '',
	category: 'main',
	pricingType: 'fixed',
	basePrice: null,
	percentageValue: null,
	priceTiers: [],
	restrictedToService: null,
	sortOrder: null,
	isActive: true,
	discountRole: null,
	options: [],
}

const ServiceDetail = () => {
	const navigate = useNavigate()
	const { id } = useParams<{ id: string }>()
	const isEdit = !!id
	const [pageLoading, setPageLoading] = useState(isEdit)
	const [submitting, setSubmitting] = useState(false)

	const {
		register,
		handleSubmit,
		control,
		reset,
		watch,
		formState: { errors },
	} = useForm<ServiceFormData>({
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		resolver: zodResolver(serviceSchema) as any,
		defaultValues: DEFAULT_VALUES,
	})

	const pricingType = watch('pricingType')
	const category = watch('category')

	const { fields: tierFields, append: appendTier, remove: removeTier } = useFieldArray({
		control,
		name: 'priceTiers',
	})

	const { fields: optionFields, append: appendOption, remove: removeOption } = useFieldArray({
		control,
		name: 'options',
	})

	useEffect(() => {
		if (!isEdit) return
		const load = async () => {
			try {
				const data: Service = await getItem('services', id!)
				reset({
					name: data.name ?? '',
					description: data.description ?? '',
					durationDescription: data.durationDescription ?? '',
					category: data.category ?? 'main',
					pricingType: data.pricingType ?? 'fixed',
					basePrice: data.basePrice ?? null,
					percentageValue: data.percentageValue ?? null,
					priceTiers: data.priceTiers ?? [],
					restrictedToService: data.restrictedToService ?? null,
					sortOrder: data.sortOrder ?? null,
					isActive: data.isActive === undefined ? true : data.isActive !== 0,
					discountRole: data.discountRole ?? null,
					options: data.options ?? [],
				})
			} catch {
				toast.error('Errore nel caricamento del servizio.')
				navigate('/admin/services')
			} finally {
				setPageLoading(false)
			}
		}
		load()
	}, [id, isEdit])

	const onSubmit = async (formData: ServiceFormData) => {
		setSubmitting(true)
		try {
			const payload: Record<string, any> = {
				name: formData.name,
				description: formData.description,
				category: formData.category,
				pricingType: formData.pricingType,
				isActive: formData.isActive ? 1 : 0,
				sortOrder: formData.sortOrder ?? null,
				durationDescription: formData.durationDescription?.trim() || null,
				restrictedToService: formData.restrictedToService?.trim() || null,
				discountRole: formData.discountRole?.trim() || null,
			}
			if (formData.pricingType === 'fixed') {
				payload.basePrice = formData.basePrice
				payload.percentageValue = null
				payload.priceTiers = null
			} else if (formData.pricingType === 'tiered') {
				payload.priceTiers = formData.priceTiers
				payload.basePrice = null
				payload.percentageValue = null
			} else if (formData.pricingType === 'percentage') {
				payload.percentageValue = formData.percentageValue
				payload.basePrice = formData.basePrice ?? null
				payload.priceTiers = null
			}

			// Genera publicId per le opzioni nuove (senza publicId)
			payload.options = (formData.options ?? []).map((opt) => ({
				...opt,
				publicId: opt.publicId || crypto.randomUUID(),
				price: Number(opt.price),
			}))
			if (payload.options.length === 0) payload.options = null

			if (isEdit) {
				await updateItem('services', id!, payload)
				toast.success('Servizio aggiornato.')
			} else {
				await createItem('services', payload)
				toast.success('Servizio creato.')
			}
			navigate('/admin/services')
		} catch (err: any) {
			toast.error(err?.response?.data?.error?.message ?? 'Errore durante il salvataggio.')
		} finally {
			setSubmitting(false)
		}
	}

	if (pageLoading) {
		return (
			<div className="min-h-full flex items-center justify-center">
				<div className="text-center">
					<div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary mx-auto mb-3"></div>
					<p className="text-gray-500 text-sm">Caricamento servizio…</p>
				</div>
			</div>
		)
	}

	return (
		<div className="min-h-full">
			<div className="container mx-auto p-4 md:p-6">
				<form onSubmit={handleSubmit(onSubmit as any)} noValidate>
					<div className="flex items-center gap-4 mb-6">
						<h1 className="text-2xl font-bold text-gray-800 flex-1">
							{isEdit ? 'Modifica servizio' : 'Nuovo servizio'}
						</h1>
						<button
							type="button"
							onClick={() => navigate('/admin/services')}
							className="btn secondary-wire"
							disabled={submitting}
						>
							Annulla
						</button>
						<button
							type="submit"
							className="btn primary bg-primary hover:bg-primary-dark"
							disabled={submitting}
						>
							{submitting ? (
								<>
									<i className="fa-solid fa-spinner fa-spin mr-2" />
									Salvataggio…
								</>
							) : (
								<>
									<i className={`fa-solid ${isEdit ? 'fa-floppy-disk' : 'fa-plus'} mr-2`} />
									{isEdit ? 'Salva modifiche' : 'Crea servizio'}
								</>
							)}
						</button>
					</div>

					{/* Informazioni base */}
					<FormSection title="Informazioni base">
						<div className="space-y-4">
							<Input
								label="Nome *"
								{...register('name')}
								error={errors.name}
							/>
							<Textarea
								label="Descrizione *"
								rows={3}
								{...register('description')}
								error={errors.description}
							/>
							<Input
								label="Descrizione durata"
								{...register('durationDescription')}
								error={errors.durationDescription}
								placeholder="Es. 30–60 min"
							/>
						</div>
					</FormSection>

					{/* Classificazione */}
					<FormSection title="Classificazione">
						<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
							<Controller
								name="category"
								control={control}
								render={({ field }) => (
									<Select
										label="Categoria *"
										name="category"
										value={field.value}
										onChange={(e) => field.onChange(e.target.value)}
										options={CATEGORY_OPTIONS}
										error={errors.category ? { message: errors.category.message ?? '' } : undefined}
										placeholder="Seleziona categoria"
									/>
								)}
							/>
							<Controller
								name="pricingType"
								control={control}
								render={({ field }) => (
									<Select
										label="Tipo tariffazione *"
										name="pricingType"
										value={field.value}
										onChange={(e) => field.onChange(e.target.value)}
										options={PRICING_TYPE_OPTIONS}
										error={errors.pricingType ? { message: errors.pricingType.message ?? '' } : undefined}
										placeholder="Seleziona tipo"
									/>
								)}
							/>
							<Input
								label="Ordine visualizzazione"
								type="number"
								{...register('sortOrder')}
								error={errors.sortOrder as any}
								placeholder="Es. 1"
							/>
							<div className="flex items-end pb-1">
								<Controller
									name="isActive"
									control={control}
									render={({ field }) => (
										<label className="flex items-center gap-2 cursor-pointer select-none">
											<input
												type="checkbox"
												checked={field.value}
												onChange={(e) => field.onChange(e.target.checked)}
												className="w-4 h-4 accent-primary"
											/>
											<span className="text-sm font-medium text-gray-700">Servizio attivo</span>
										</label>
									)}
								/>
							</div>
						</div>
						{category === 'extra' && (
							<div className="mt-4">
								<Input
									label="Collegato al servizio (publicId)"
									{...register('restrictedToService')}
									error={errors.restrictedToService as any}
									placeholder="Lascia vuoto per extra disponibile su tutti i servizi"
								/>
								<p className="text-xs text-gray-400 mt-1">
									Compila solo se questo extra è disponibile esclusivamente per un singolo servizio principale.
								</p>
							</div>
						)}
						<div className="mt-4">
							<Controller
								name="discountRole"
								control={control}
								render={({ field }) => (
									<Select
										label="Ruolo sconti"
										name="discountRole"
										value={field.value ?? ''}
										onChange={(e) => field.onChange(e.target.value || null)}
										options={DISCOUNT_ROLE_OPTIONS}
									/>
								)}
							/>
							<p className="text-xs text-gray-400 mt-1">
								Indica se questo servizio conta come unità per gli sconti quantità e/o fa parte di un pacchetto sconto.
							</p>
						</div>
					</FormSection>

					{/* Prezzi */}
					<FormSection title="Prezzi">
						{pricingType === 'fixed' && (
							<Input
								label="Prezzo (€) *"
								type="number"
								step="0.01"
								{...register('basePrice')}
								error={errors.basePrice as any}
								placeholder="Es. 350.00"
							/>
						)}

						{pricingType === 'percentage' && (
							<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
								<div>
									<Input
										label="Percentuale aggiuntiva (%) *"
										type="number"
										step="0.01"
										{...register('percentageValue')}
										error={errors.percentageValue as any}
										placeholder="Es. 30"
									/>
									<p className="text-xs text-gray-400 mt-1">
										Verrà applicata sul totale dei servizi selezionati.
									</p>
								</div>
								<Input
									label="Prezzo minimo (€)"
									type="number"
									step="0.01"
									{...register('basePrice')}
									error={errors.basePrice as any}
									placeholder="Opzionale"
								/>
							</div>
						)}

						{pricingType === 'tiered' && (
							<div className="space-y-3">
								{tierFields.map((field, index) => (
									<div key={field.id} className="flex gap-2 items-start">
										<div className="flex-1">
											<Input
												label={index === 0 ? 'Etichetta fascia' : ''}
												{...register(`priceTiers.${index}.label`)}
												error={errors.priceTiers?.[index]?.label as any}
												placeholder="Es. fino a 3h"
											/>
										</div>
										<div className="w-28">
											<Input
												label={index === 0 ? 'Prezzo (€)' : ''}
												type="number"
												step="0.01"
												{...register(`priceTiers.${index}.price`)}
												error={errors.priceTiers?.[index]?.price as any}
												placeholder="0.00"
											/>
										</div>
										<button
											type="button"
											onClick={() => removeTier(index)}
											className={`text-red-400 hover:text-red-600 p-2 flex-shrink-0 ${index === 0 ? 'mt-6' : ''}`}
										>
											<i className="fa-solid fa-trash text-sm" />
										</button>
									</div>
								))}
								{(errors.priceTiers as any)?.message && (
									<p className="text-red-500 text-xs">{(errors.priceTiers as any).message}</p>
								)}
								<button
									type="button"
									onClick={() => appendTier({ label: '', price: 0 })}
									className="btn secondary-wire text-sm"
								>
									<i className="fa-solid fa-plus mr-2" />
									Aggiungi fascia
								</button>
							</div>
						)}
					</FormSection>

					{/* Opzioni servizio */}
					<FormSection title="Opzioni">
						<p className="text-xs text-gray-500 mb-3">
							Opzioni aggiuntive selezionabili dall'utente all'interno di questo servizio (es. montaggio non cronologico).
							A differenza degli extra, le opzioni non hanno categoria propria e non ricevono lo sconto Bonus automaticamente.
						</p>
						<div className="space-y-3">
							{optionFields.map((field, index) => (
								<div key={field.id} className="flex gap-2 items-start border border-gray-200 rounded-lg p-3 bg-gray-50">
									<div className="flex-1 grid grid-cols-1 sm:grid-cols-4 gap-2">
										<div>
											<Input
												label={index === 0 ? 'Nome opzione' : ''}
												{...register(`options.${index}.name`)}
												error={(errors.options as any)?.[index]?.name}
												placeholder="Es. Non Chronological Edit"
											/>
										</div>
										<div>
											<Input
												label={index === 0 ? 'Prezzo (€)' : ''}
												type="number"
												step="0.01"
												{...register(`options.${index}.price`)}
												error={(errors.options as any)?.[index]?.price}
												placeholder="0.00"
											/>
										</div>
										<div>
											<Controller
												name={`options.${index}.discountRole`}
												control={control}
												render={({ field: f }) => (
													<Select
														label={index === 0 ? 'Ruolo sconti' : ''}
														name={`options.${index}.discountRole`}
														value={f.value ?? ''}
														onChange={(e) => f.onChange(e.target.value || null)}
														options={DISCOUNT_ROLE_OPTIONS}
													/>
												)}
											/>
										</div>
										<div className="flex items-end pb-1">
											<Controller
												name={`options.${index}.exclusive`}
												control={control}
												render={({ field: f }) => (
													<label className="flex items-center gap-2 cursor-pointer select-none">
														<input
															type="checkbox"
															checked={f.value ?? false}
															onChange={(e) => f.onChange(e.target.checked)}
															className="w-4 h-4 accent-primary"
														/>
														<span className="text-sm font-medium text-gray-700">
															{index === 0 ? 'Esclusivo' : ''}
														</span>
													</label>
												)}
											/>
										</div>
									</div>
									<button
										type="button"
										onClick={() => removeOption(index)}
										className={`text-red-400 hover:text-red-600 p-2 flex-shrink-0 ${index === 0 ? 'mt-6' : ''}`}
									>
										<i className="fa-solid fa-trash text-sm" />
									</button>
								</div>
							))}
							{(errors.options as any)?.message && (
								<p className="text-red-500 text-xs">{(errors.options as any).message}</p>
							)}
							<button
								type="button"
								onClick={() => appendOption({ name: '', price: 0, discountRole: null, exclusive: false })}
								className="btn secondary-wire text-sm"
							>
								<i className="fa-solid fa-plus mr-2" />
								Aggiungi opzione
							</button>
						</div>
					</FormSection>
				</form>
			</div>
		</div>
	)
}

export default ServiceDetail
