import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'react-toastify'
import Table from '../../../Components/Table'
import PageHeader from '../../../Components/PageHeader'
import DeleteModal from '../../../Components/DeleteModal'
import { getList, deleteItem } from '../../../services/api-utility'
import type { Service } from './serviceSchema'

const ORIENTATION_LABELS: Record<string, string> = {
	vertical: 'Verticale',
	horizontal: 'Orizzontale',
	both: 'Entrambi',
}

const ORIENTATION_COLORS: Record<string, string> = {
	vertical: 'bg-blue-100 text-blue-700',
	horizontal: 'bg-green-100 text-green-700',
	both: 'bg-purple-100 text-purple-700',
}

const formatPrice = (price?: number | null) =>
	price != null ? `€${Number(price).toFixed(2)}` : '—'

const columns = [
	{
		key: 'name',
		header: 'Nome',
		width: '220px',
	},
	{
		key: 'orientation',
		header: 'Orientamento',
		width: '140px',
		render: (value: string) => (
			<span
				className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
					ORIENTATION_COLORS[value] ?? 'bg-gray-100 text-gray-600'
				}`}
			>
				{ORIENTATION_LABELS[value] ?? value}
			</span>
		),
	},
	{
		key: 'priceVertical',
		header: 'Prezzi',
		render: (_: any, item: Service) => (
			<div className="text-xs space-y-0.5">
				<div>
					<span className="text-gray-400">V: </span>
					{formatPrice(item.priceVertical)}
				</div>
				<div>
					<span className="text-gray-400">H: </span>
					{formatPrice(item.priceHorizontal)}
				</div>
				<div>
					<span className="text-gray-400">V+H: </span>
					{formatPrice(item.priceBoth)}
				</div>
			</div>
		),
	},
	{
		key: 'minDuration',
		header: 'Durata',
		render: (_: any, item: Service) => {
			if (item.durationDescription) return <span className="text-sm">{item.durationDescription}</span>
			if (item.minDuration != null || item.maxDuration != null) {
				return (
					<span className="text-sm">
						{item.minDuration ?? '?'}–{item.maxDuration ?? '?'} min
					</span>
				)
			}
			return <span className="text-gray-400">—</span>
		},
	},
	{
		key: 'description',
		header: 'Descrizione',
		type: 'note' as const,
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
			setServices(data)
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
		<div className="min-h-[calc(100vh-64px)]">
			<PageHeader
				icon="fa-solid fa-film"
				title="Servizi"
				subtitle="Gestione dei servizi di montaggio"
				buttons={[
					{
						label: 'Nuovo servizio',
						icon: 'fa-solid fa-plus',
						variant: 'primary',
						onClick: () => navigate('/admin/services/new'),
					},
				]}
			/>
			<div className="container mx-auto p-4 md:p-6">
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
