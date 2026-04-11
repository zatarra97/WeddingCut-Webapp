import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'react-toastify'
import Table from '../../../Components/Table'
import DeleteModal from '../../../Components/DeleteModal'
import { getList, deleteItem } from '../../../services/api-utility'
import type { Service } from './serviceSchema'

const CATEGORY_LABELS: Record<string, string> = {
	main: 'Principale',
	extra: 'Extra',
	delivery: 'Consegna',
}

const CATEGORY_COLORS: Record<string, string> = {
	main: 'bg-blue-100 text-blue-700',
	extra: 'bg-amber-100 text-amber-700',
	delivery: 'bg-green-100 text-green-700',
}

const PRICING_LABELS: Record<string, string> = {
	fixed: 'Fisso',
	tiered: 'A fasce',
	percentage: 'Percentuale',
}

const formatPricing = (item: Service) => {
	if (item.pricingType === 'fixed')
		return item.basePrice != null ? `€${Number(item.basePrice).toFixed(2)}` : '—'
	if (item.pricingType === 'percentage')
		return item.percentageValue != null ? `+${item.percentageValue}%` : '—'
	if (item.pricingType === 'tiered') {
		const tiers = item.priceTiers ?? []
		if (!tiers.length) return '—'
		const min = Math.min(...tiers.map((t) => t.price))
		const max = Math.max(...tiers.map((t) => t.price))
		return min === max ? `€${min.toFixed(2)}` : `€${min.toFixed(2)} – €${max.toFixed(2)}`
	}
	return '—'
}

const columns = [
	{
		key: 'sortOrder',
		header: '#',
		width: '48px',
		render: (value: number | null) => (
			<span className="text-gray-400 text-xs">{value ?? '—'}</span>
		),
	},
	{
		key: 'name',
		header: 'Nome',
	},
	{
		key: 'category',
		header: 'Categoria',
		width: '120px',
		render: (value: string) => (
			<span
				className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
					CATEGORY_COLORS[value] ?? 'bg-gray-100 text-gray-600'
				}`}
			>
				{CATEGORY_LABELS[value] ?? value}
			</span>
		),
	},
	{
		key: 'pricingType',
		header: 'Tariffazione',
		width: '120px',
		render: (value: string) => (
			<span className="text-xs text-gray-500">{PRICING_LABELS[value] ?? value}</span>
		),
	},
	{
		key: 'basePrice',
		header: 'Prezzo',
		width: '140px',
		render: (_: any, item: Service) => (
			<span className="text-sm font-medium text-gray-700">{formatPricing(item)}</span>
		),
	},
	{
		key: 'isActive',
		header: 'Attivo',
		width: '70px',
		render: (value: number) => (
			<span className={`text-xs font-medium ${value ? 'text-green-600' : 'text-gray-400'}`}>
				{value ? 'Sì' : 'No'}
			</span>
		),
	},
]

const Services = () => {
	const navigate = useNavigate()
	const [services, setServices] = useState<Service[]>([])
	const [loading, setLoading] = useState(true)
	const [deleteModal, setDeleteModal] = useState<{ open: boolean; item: Service | null }>({
		open: false,
		item: null,
	})
	const [deleteLoading, setDeleteLoading] = useState(false)

	const loadServices = async () => {
		setLoading(true)
		try {
			const data = await getList('services')
			setServices([...data].sort((a, b) => (a.sortOrder ?? 9999) - (b.sortOrder ?? 9999)))
		} catch {
			toast.error('Errore nel caricamento dei servizi.')
		} finally {
			setLoading(false)
		}
	}

	useEffect(() => {
		loadServices()
	}, [])

	const handleDelete = async () => {
		if (!deleteModal.item) return
		setDeleteLoading(true)
		try {
			await deleteItem('services', deleteModal.item.id)
			toast.success('Servizio eliminato.')
			setDeleteModal({ open: false, item: null })
			loadServices()
		} catch {
			toast.error("Errore durante l'eliminazione.")
		} finally {
			setDeleteLoading(false)
		}
	}

	const actions = [
		{
			icon: 'fa-pen',
			tooltip: 'Modifica',
			method: (item: Service) => navigate(`/admin/services/${item.id}`),
		},
		{
			icon: 'fa-trash',
			tooltip: 'Elimina',
			method: (item: Service) => setDeleteModal({ open: true, item }),
		},
	]

	return (
		<div className="min-h-full">
			<div className="container mx-auto p-4 md:p-6">
				<div className="flex items-center gap-4 mb-6">
					<h1 className="text-2xl font-bold text-gray-800 flex-1">Servizi</h1>
					<button
						onClick={() => navigate('/admin/services/new')}
						className="btn primary bg-primary hover:bg-primary-dark transition-colors duration-200"
					>
						<i className="fa-solid fa-plus mr-2"></i>
						Nuovo servizio
					</button>
				</div>
				<Table columns={columns} data={services} actions={actions} loading={loading} />
			</div>

			<DeleteModal
				isOpen={deleteModal.open}
				onClose={() => setDeleteModal({ open: false, item: null })}
				onConfirm={handleDelete}
				title="Elimina servizio"
				description={`Stai per eliminare il servizio "${deleteModal.item?.name}". L'operazione non è reversibile.`}
				isLoading={deleteLoading}
			/>
		</div>
	)
}

export default Services
