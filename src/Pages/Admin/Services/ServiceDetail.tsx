import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'react-toastify'
import Input from '../../../Components/Input'
import Textarea from '../../../Components/Textarea'
import Select from '../../../Components/Select'
import PageHeader from '../../../Components/PageHeader'
import FormSection from '../../../Components/FormSection'
import { getItem, createItem, updateItem } from '../../../services/api-utility'
import { serviceSchema, type ServiceFormData, type Service } from './serviceSchema'

const ORIENTATION_OPTIONS = [
	{ value: 'vertical', label: 'Verticale' },
	{ value: 'horizontal', label: 'Orizzontale' },
	{ value: 'both', label: 'Entrambi' },
]

const DEFAULT_VALUES: ServiceFormData = {
	name: '',
	description: '',
	durationDescription: '',
	minDuration: null,
	maxDuration: null,
	orientation: 'both',
	priceVertical: null,
	priceHorizontal: null,
	priceBoth: null,
	additionalOptions: '',
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
		formState: { errors },
	} = useForm<ServiceFormData>({
		resolver: zodResolver(serviceSchema),
		defaultValues: DEFAULT_VALUES,
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
					minDuration: data.minDuration ?? null,
					maxDuration: data.maxDuration ?? null,
					orientation: data.orientation ?? 'both',
					priceVertical: data.priceVertical ?? null,
					priceHorizontal: data.priceHorizontal ?? null,
					priceBoth: data.priceBoth ?? null,
					additionalOptions: data.additionalOptions
						? JSON.stringify(data.additionalOptions, null, 2)
						: '',
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
				orientation: formData.orientation,
			}
			if (formData.durationDescription?.trim())
				payload.durationDescription = formData.durationDescription.trim()
			if (formData.minDuration != null) payload.minDuration = formData.minDuration
			if (formData.maxDuration != null) payload.maxDuration = formData.maxDuration
			if (formData.priceVertical != null) payload.priceVertical = formData.priceVertical
			if (formData.priceHorizontal != null) payload.priceHorizontal = formData.priceHorizontal
			if (formData.priceBoth != null) payload.priceBoth = formData.priceBoth
			if (formData.additionalOptions?.trim())
				payload.additionalOptions = JSON.parse(formData.additionalOptions)

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
			<div className="min-h-[calc(100vh-64px)] flex items-center justify-center">
				<div className="text-center">
					<div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary mx-auto mb-3"></div>
					<p className="text-gray-500 text-sm">Caricamento servizio…</p>
				</div>
			</div>
		)
	}

	return (
		<div className="min-h-[calc(100vh-64px)]">
			<PageHeader
				icon={isEdit ? 'fa-solid fa-pen' : 'fa-solid fa-plus'}
				title={isEdit ? 'Modifica servizio' : 'Nuovo servizio'}
				backButton={{ route: '/admin/services' }}
			/>

			<div className="container mx-auto p-4 md:p-6 max-w-3xl">
				<form onSubmit={handleSubmit(onSubmit)} noValidate>
					{/* Sezione: Informazioni base */}
					<FormSection title="Informazioni base">
						<div className="space-y-4">
							<Input
								label="Nome *"
								name="name"
								{...register('name')}
								error={errors.name}
							/>
							<Textarea
								label="Descrizione *"
								name="description"
								rows={4}
								{...register('description')}
								error={errors.description}
							/>
							<Controller
								name="orientation"
								control={control}
								render={({ field }) => (
									<Select
										label="Orientamento *"
										name="orientation"
										value={field.value}
										onChange={(e) => field.onChange(e.target.value)}
										options={ORIENTATION_OPTIONS}
										error={errors.orientation ? { message: errors.orientation.message ?? '' } : undefined}
										placeholder="Seleziona orientamento"
									/>
								)}
							/>
						</div>
					</FormSection>

					{/* Sezione: Durata */}
					<FormSection title="Durata">
						<div className="space-y-4">
							<Input
								label="Descrizione durata"
								name="durationDescription"
								{...register('durationDescription')}
								error={errors.durationDescription}
								placeholder="Es. 30–60 minuti"
							/>
							<div className="grid grid-cols-2 gap-4">
								<Input
									label="Durata minima (min)"
									name="minDuration"
									type="number"
									{...register('minDuration')}
									error={errors.minDuration as any}
								/>
								<Input
									label="Durata massima (min)"
									name="maxDuration"
									type="number"
									{...register('maxDuration')}
									error={errors.maxDuration as any}
								/>
							</div>
						</div>
					</FormSection>

					{/* Sezione: Prezzi */}
					<FormSection title="Prezzi">
						<div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
							<Input
								label="Prezzo verticale (€)"
								name="priceVertical"
								type="number"
								step="0.01"
								{...register('priceVertical')}
								error={errors.priceVertical as any}
							/>
							<Input
								label="Prezzo orizzontale (€)"
								name="priceHorizontal"
								type="number"
								step="0.01"
								{...register('priceHorizontal')}
								error={errors.priceHorizontal as any}
							/>
							<Input
								label="Prezzo entrambi (€)"
								name="priceBoth"
								type="number"
								step="0.01"
								{...register('priceBoth')}
								error={errors.priceBoth as any}
							/>
						</div>
					</FormSection>

					{/* Sezione: Opzioni aggiuntive */}
					<FormSection title="Opzioni aggiuntive" defaultOpen={false}>
						<Textarea
							label="Opzioni aggiuntive (JSON)"
							name="additionalOptions"
							rows={6}
							{...register('additionalOptions')}
							error={errors.additionalOptions}
							placeholder='{"chiave": "valore"}'
						/>
					</FormSection>

					{/* Bottoni */}
					<div className="flex justify-end gap-3 mt-8">
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
				</form>
			</div>
		</div>
	)
}

export default ServiceDetail
