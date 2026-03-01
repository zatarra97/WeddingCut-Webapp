import { Link } from 'react-router-dom'

const NAV_CARDS = [
	{
		to: '/admin/services',
		icon: 'fa-solid fa-film',
		label: 'Servizi',
		description: 'Gestisci i servizi di montaggio disponibili',
		color: 'bg-purple-600',
	},
	{
		to: '/admin/orders',
		icon: 'fa-solid fa-clipboard-list',
		label: 'Ordini',
		description: 'Visualizza e gestisci gli ordini ricevuti',
		color: 'bg-blue-600',
	},
	{
		to: '/admin/messages',
		icon: 'fa-solid fa-comments',
		label: 'Messaggi',
		description: 'Leggi e rispondi alle conversazioni degli utenti',
		color: 'bg-green-600',
	},
	{
		to: '/admin/users',
		icon: 'fa-solid fa-users',
		label: 'Utenti',
		description: 'Visualizza e gestisci gli account utente',
		color: 'bg-orange-600',
	},
]

const AdminDashboard = () => {
	return (
		<div className="min-h-[calc(100vh-64px)]">
			<nav className="sticky top-14 z-40 h-12 bg-gray-800 text-white shadow-sm">
				<div className="container mx-auto flex items-center px-4 md:px-6 pt-3">
					<span className="text-sm font-medium">Area Amministratore</span>
				</div>
			</nav>
			<div className="container mx-auto p-4 md:p-6">
				<h1 className="text-2xl md:text-3xl font-bold text-gray-800 mb-6">Dashboard Admin</h1>
				<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
					{NAV_CARDS.map((card) => (
						<Link
							key={card.to}
							to={card.to}
							className="flex items-center gap-4 p-5 bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md hover:border-gray-300 transition-all"
						>
							<div className={`flex items-center justify-center w-12 h-12 rounded-lg ${card.color} shrink-0`}>
								<i className={`${card.icon} text-white text-lg`} />
							</div>
							<div>
								<p className="font-semibold text-gray-800">{card.label}</p>
								<p className="text-sm text-gray-500 mt-0.5">{card.description}</p>
							</div>
						</Link>
					))}
				</div>
			</div>
		</div>
	)
}

export default AdminDashboard
