import React, { useState } from "react"
import { NavLink } from "react-router-dom"
import { isAdmin, isDemoMode } from "../services/role-utility"
import logo from "../Images/horizzontal.png"
import logoCollapsed from "../Images/logo.png"
import avatar from "../Images/avatar.png"
import { CognitoUser } from "amazon-cognito-identity-js"

interface SidebarProps {
	onSidebarToggle: (isExpanded: boolean) => void
	user: CognitoUser | null
	signOut: () => void
	initialExpanded: boolean
}

interface NavItemProps {
	to: string
	icon: string
	text: string
	isExpanded: boolean
	onClick?: () => void
	isSubmenu?: boolean
	onMobileClick?: () => void
}

const Sidebar: React.FC<SidebarProps> = ({ onSidebarToggle, user, signOut, initialExpanded }) => {
	const [isExpanded, setIsExpanded] = useState(initialExpanded)
	//const [isCatalogOpen, setIsCatalogOpen] = useState(false);

	const toggleSidebar = () => {
		const newIsExpanded = !isExpanded
		setIsExpanded(newIsExpanded)
		onSidebarToggle(newIsExpanded)
	}

	const closeSidebarOnMobile = () => {
		if (window.innerWidth < 768 && isExpanded) {
			setIsExpanded(false)
			onSidebarToggle(false)
		}
	}

	const handleSignOut = async () => {
		try {
			await signOut()
		} catch (error) {
			console.error("Errore durante il logout:", error)
		}
	}

	/*const toggleCatalog = () => {
    setIsCatalogOpen(!isCatalogOpen);
  };*/

	const renderExpandedHeader = () => (
		<div className="flex items-center justify-between mb-6 px-2 py-3">
			<div className="flex items-center">
				<img src={logo} className="h-12 w-auto" alt="Logo" />
			</div>
			<button
				onClick={toggleSidebar}
				className="flex items-center justify-center cursor-pointer bg-primary/20 hover:bg-primary/30 rounded-full p-2.5 w-10 h-10 transition-all duration-200 group"
				aria-label="Toggle Sidebar"
			>
				<i className="fas fa-chevron-left text-lg text-primary"></i>
			</button>
		</div>
	)

	const renderCollapsedHeader = () => (
		<div className="flex flex-col items-center py-4 mb-6">
			<button
				onClick={toggleSidebar}
				className="flex items-center justify-center cursor-pointer bg-primary/20 hover:bg-primary/30 rounded-full p-2.5 w-10 h-10 mb-4 transition-all duration-200 group"
				aria-label="Toggle Sidebar"
			>
				<i className="fas fa-chevron-right text-lg text-primary"></i>
			</button>
			<img src={logoCollapsed} className="h-10 w-auto" alt="Logo" />
		</div>
	)

	const renderUserInfo = () => (
		<div className="mb-6 px-2 ">
			<div className="flex flex-row md:flex-col md:justify-center">
				<div className="flex justify-start md:justify-center min-w-12">
					<div className="md:text-center rounded-full border-4 border-green-400">
						<img src={avatar} className="h-10 md:h-16 rounded-full" alt="avatar" />
					</div>
				</div>
				<div className="md:text-center mt-2 w-full">
					<h2 className="text-sm font-semibold px-2 truncate max-w-72 sm:max-w-80 md:max-w-none text-gray-300">
						{user?.getUsername() || "Admin"}
					</h2>
				</div>
			</div>
		</div>
	)

	return (
		<aside
			id="separator-sidebar"
			className={`fixed top-0 left-0 z-40 h-screen transition-all duration-300 ${isExpanded ? "w-full md:w-72" : "w-14"}`}
			aria-label="Sidebar"
		>
			<div className="h-full px-1 pb-4 overflow-y-auto bg-slate-800 flex flex-col">
				<div className="flex-1">
					{isExpanded ? renderExpandedHeader() : renderCollapsedHeader()}

					{isExpanded && renderUserInfo()}

					{isDemoMode() &&
						(isExpanded ? (
							<div className="mx-2 mb-3 px-3 py-2 rounded-lg bg-gradient-to-r from-red-50 to-red-100 border border-red-200 shadow-sm">
								<div className="flex items-center gap-2">
									<span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-red-500 text-white">
										<i className="fa-solid fa-flask text-xs"></i>
									</span>
									<div className="leading-tight">
										<p className="text-red-700 text-sm font-semibold">Modalità demo</p>
										<p className="text-red-600 text-xs">Le funzionalità di creazione, modifica</p>
										<p className="text-red-600 text-xs">ed eliminazione sono state bloccate.</p>
									</div>
								</div>
							</div>
						) : (
							<div className="mx-2 mb-3 flex justify-center">
								<span
									className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-red-500 text-white"
									title="Modalità demo"
									aria-label="Modalità demo"
								>
									<i className="fa-solid fa-flask text-sm"></i>
								</span>
							</div>
						))}

					<ul className="space-y-2 font-medium border-t border-gray-700 pt-4 pl-1">
						<NavItem to="/" icon="fa-gauge" text="Dashboard" isExpanded={isExpanded} onMobileClick={closeSidebarOnMobile} />
						<NavItem to="/clients" icon="fa-users" text="Clienti" isExpanded={isExpanded} onMobileClick={closeSidebarOnMobile} />
						<NavItem to="/contacts" icon="fa-address-book" text="Contatti" isExpanded={isExpanded} onMobileClick={closeSidebarOnMobile} />
						<NavItem to="/plants" icon="fa-industry" text="Impianti" isExpanded={isExpanded} onMobileClick={closeSidebarOnMobile} />
						<NavItem
							to="/plant-meters"
							icon="fa-plug-circle-bolt"
							text="Contatori di scambio"
							isExpanded={isExpanded}
							onMobileClick={closeSidebarOnMobile}
						/>
						<NavItem
							to="/plant-sections"
							icon="fa-solar-panel"
							text="Sezioni d'impianto"
							isExpanded={isExpanded}
							onMobileClick={closeSidebarOnMobile}
						/>
						<NavItem
							to="/plant-section-pitches"
							icon="fa-diagram-project"
							text="Falde sezioni d'impianto"
							isExpanded={isExpanded}
							onMobileClick={closeSidebarOnMobile}
						/>
						{/*}
            <NavItem to="/pm-energy-costs" icon="fa-euro-sign" text="Costi mensili Contatori di scambio" isExpanded={isExpanded} onMobileClick={closeSidebarOnMobile} />
            */}
						<NavItem
							to="/catalog-meters"
							icon="fa-microchip"
							text="Catalogo contatori"
							isExpanded={isExpanded}
							onMobileClick={closeSidebarOnMobile}
						/>
						<NavItem to="/obligations" icon="fa-gavel" text="Adempimenti" isExpanded={isExpanded} onMobileClick={closeSidebarOnMobile} />
						<NavItem to="/users" icon="fa-user" text="Utenti backoffice" isExpanded={isExpanded} onMobileClick={closeSidebarOnMobile} />
					</ul>

					<ul className="space-y-2 font-medium border-gray-700">
						{/*Dropdown 
              <button 
                type="button" 
                className="flex items-center w-full p-2 text-base text-gray-300 transition duration-75 rounded-lg group hover:bg-gray-800"
                onClick={toggleCatalog}
              >
                <i className="fas fa-book w-6 h-6 text-gray-300 pt-1"></i>
                {isExpanded && <span className="flex-1 ms-3 text-left rtl:text-right whitespace-nowrap">Catalogo</span>}
                {isExpanded && (
                  <svg className={`w-3 h-3 transition-transform ${isCatalogOpen ? 'rotate-180' : ''}`} aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 10 6">
                    <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="m1 1 4 4 4-4"/>
                  </svg>
                )}
              </button>
              {isExpanded && isCatalogOpen && (
                <ul className="py-2 space-y-2 animation-smooth">
                  <NavItem to="/catalog/read-parameters" icon="fa-list" text="Parametri lettura" isExpanded={isExpanded} isSubmenu={true} onMobileClick={closeSidebarOnMobile} />
                </ul>
              )}
            </li>
            */}
						{isAdmin() && <>{/*Pagine private per ruolo */}</>}
					</ul>

					<ul className="pt-4 pl-1 mt-4 space-y-2 font-medium border-t border-gray-700">
						<NavItem
							to=""
							icon="fa-door-open"
							text="Esci"
							isExpanded={isExpanded}
							onClick={handleSignOut}
							onMobileClick={closeSidebarOnMobile}
						/>
					</ul>
				</div>

				{/* Versione del sito */}
				<div className="mt-auto pt-4 text-center">
					<span className="text-gray-500 font-semibold">v{__APP_VERSION__ || "1.0.0"}</span>
				</div>
			</div>
		</aside>
	)
}

const NavItem: React.FC<NavItemProps> = ({ to, icon, text, isExpanded, onClick, isSubmenu = false, onMobileClick }) => {
	const handleClick = () => {
		if (onMobileClick) {
			onMobileClick()
		}

		if (onClick) {
			onClick()
		}
	}

	const content = (
		<>
			<i className={`fas ${icon} w-6 h-6 pt-1 text-primary`}></i>
			{isExpanded && <span className={`ms-3 ${isSubmenu ? "text-base" : ""}`}>{text}</span>}
		</>
	)

	if (onClick) {
		return (
			<li className="cursor-pointer">
				<button
					className="flex items-center w-full p-2.5 text-gray-300 rounded-lg hover:bg-gray-700 transition-all duration-200 group cursor-pointer"
					onClick={handleClick}
				>
					{content}
				</button>
			</li>
		)
	}

	return (
		<li>
			<NavLink
				to={to}
				className={({ isActive }) =>
					`flex items-center p-2.5 text-gray-300 rounded-lg hover:bg-gray-700 transition-all duration-200 group ${
						isActive ? "bg-gray-700" : ""
					} ${isSubmenu ? "pl-8" : ""}`
				}
				onClick={handleClick}
			>
				{content}
			</NavLink>
		</li>
	)
}

export default Sidebar
