import React, { useEffect, useRef } from "react"
import { useJsApiLoader } from "@react-google-maps/api"
import { Address } from "../constants"

const libraries: "places"[] = ["places"]

interface AddressInputProps {
	label?: string
	name: string
	onChange: (address: Address) => void
	onBlur?: (event: React.FocusEvent<HTMLInputElement>) => void
	value?: Address
	error?: { message: string }
}

interface AddressComponent {
	long_name: string
	short_name: string
	types: string[]
}

const AddressInput = React.forwardRef<HTMLInputElement, AddressInputProps>(({ label, name, onChange, onBlur, value, error }, ref) => {
	const { isLoaded, loadError } = useJsApiLoader({
		googleMapsApiKey: import.meta.env.VITE_GOOGLE_API_KEY || "",
		libraries,
		id: "google-maps-script",
		version: "weekly",
	})

	const inputRef = useRef<HTMLInputElement | null>(null)
	const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null)

	const getAddressComponent = (addressComponents: AddressComponent[], types: string[]): string => {
		const component = addressComponents.find((comp) => comp.types.some((type) => types.includes(type)))
		return component ? component.long_name : ""
	}

	useEffect(() => {
		if (isLoaded && inputRef.current && !autocompleteRef.current) {
			// Per ora manteniamo l'API legacy finché la nuova non è completamente supportata
			const autocomplete = new google.maps.places.Autocomplete(inputRef.current, {
				fields: ["address_components", "formatted_address", "place_id"],
			})

			autocomplete.addListener("place_changed", () => {
				const place = autocomplete.getPlace()
				const addressComponents = place.address_components || []

				const address: Address = {
					street_number: getAddressComponent(addressComponents, ["street_number"]),
					route: getAddressComponent(addressComponents, ["route"]),
					locality: getAddressComponent(addressComponents, ["locality"]),
					administrative_area_level_1: getAddressComponent(addressComponents, ["administrative_area_level_1"]),
					postal_code: getAddressComponent(addressComponents, ["postal_code"]),
					country: getAddressComponent(addressComponents, ["country"]),
					formatted_address: place.formatted_address || "",
				}

				onChange(address)
			})

			autocompleteRef.current = autocomplete
		}

		return () => {
			if (autocompleteRef.current) {
				google.maps.event.clearInstanceListeners(autocompleteRef.current)
			}
		}
	}, [isLoaded, onChange])

	if (loadError) {
		return <div>Errore nel caricamento di Google Maps</div>
	}

	if (!isLoaded) {
		return <div>Caricamento Google Maps...</div>
	}

	const inputValue = value && value.formatted_address ? value.formatted_address : ""

	return (
		<div className="">
			{label && <label className="form-label">{label}</label>}
			<input
				ref={(element) => {
					inputRef.current = element
					if (typeof ref === "function") ref(element)
					else if (ref) ref.current = element
				}}
				type="text"
				name={name}
				placeholder="Indirizzo"
				value={inputValue}
				onChange={(e: React.ChangeEvent<HTMLInputElement>) => onChange({ ...value, formatted_address: e.target.value } as Address)}
				onBlur={onBlur}
				className={`w-full appearance-none border border-gray-300 rounded focus:ring-1 focus:ring-primary focus:border-primary py-2 px-3 leading-tight bg-white form-input ${
					error ? "border-red-500" : ""
				}`}
			/>
			{error && <p className="text-red-500 text-xs mt-1">{error.message}</p>}
		</div>
	)
})

export default AddressInput
