import React, { useState, useEffect } from "react"

// Tema personalizzato per i tab header
const tabHeaderClasses = {
	base: "flex items-center justify-center rounded-t-lg p-2 md:p-4 text-xs md:text-sm font-medium first:ml-0 focus:outline-none cursor-pointer",
	active: "rounded-t-lg border-b-2 border-primary text-primary font-semibold text-sm md:text-base",
	inactive:
		"border-b-2 border-transparent text-secondary hover:border-primary/30 hover:text-primary transition-colors duration-200 text-sm md:text-base",
}

// Interfaccia per TabItem personalizzato
interface TabItemProps {
	title: string
	icon?: React.ComponentType
	tabKey?: string
	children: React.ReactNode
}

// Interfaccia per le props del componente CustomTabs
interface CustomTabsProps {
	children: React.ReactElement<TabItemProps> | React.ReactElement<TabItemProps>[]
	activeTab?: string
	onTabChange?: (newTab: string) => void
}

const CustomTabs: React.FC<CustomTabsProps> = ({ children, activeTab, onTabChange }) => {
	const [currentTabKey, setCurrentTabKey] = useState<string>("")

	// Converte children in array se necessario
	const childrenArray = Array.isArray(children) ? children : [children]

	// Inizializza la tab attiva
	useEffect(() => {
		if (activeTab) {
			setCurrentTabKey(activeTab)
		} else if (childrenArray.length > 0) {
			// Default alla prima tab
			setCurrentTabKey(childrenArray[0].props.tabKey || "tab-0")
		}
	}, [activeTab, childrenArray])

	const handleTabClick = (tabKey: string, event: React.MouseEvent<HTMLButtonElement>) => {
		event.preventDefault() // Previene il comportamento di default
		setCurrentTabKey(tabKey)
		if (onTabChange) {
			onTabChange(tabKey)
		}
	}

	// Trova la tab attiva
	const activeTabContent = childrenArray.find((child) => child.props.tabKey === currentTabKey)?.props.children

	return (
		<div>
			{/* Tab Headers */}
			<div className="relative">
				<div className="overflow-x-auto overflow-y-hidden -mx-4 px-4 md:mx-0 md:px-0 md:overflow-visible scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-transparent hover:scrollbar-thumb-gray-400">
					<div className="flex text-center -mb-px border-b border-gray-300 md:flex-wrap">
						{childrenArray.map((child, index) => {
							const tabKey = child.props.tabKey || `tab-${index}`
							const isActive = tabKey === currentTabKey
							const Icon = child.props.icon

							return (
								<button
									key={tabKey}
									type="button"
									onClick={(e) => handleTabClick(tabKey, e)}
									className={`${tabHeaderClasses.base} ${
										isActive ? tabHeaderClasses.active : tabHeaderClasses.inactive
									} whitespace-nowrap shrink-0 md:shrink`}
								>
									{Icon && <span className="hidden sm:inline">{Icon && <Icon />}</span>}
									<span>{child.props.title}</span>
								</button>
							)
						})}
					</div>
				</div>
			</div>

			{/* Tab Content */}
			<div className="py-6">{activeTabContent}</div>
		</div>
	)
}

// Componente TabItem personalizzato
const TabItem: React.FC<TabItemProps> = ({ children }) => {
	return <>{children}</>
}

// Esportiamo anche TabItem per comodità
export { TabItem }
export default CustomTabs
