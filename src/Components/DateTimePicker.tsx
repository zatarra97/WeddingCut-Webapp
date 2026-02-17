import React, { useEffect } from "react"
import { Datepicker } from "flowbite-react"
import moment from "moment"

interface DateTimePickerProps {
	label?: string
	value?: string | null
	onChange: (date: string | null) => void
	error?: { message: string }
	disableFuture?: boolean
	yearOnly?: boolean
	className?: string
	disabled?: boolean
}

const theme = {
	root: {
		base: "relative rounder",
	},
	popup: {
		root: {
			base: "absolute top-10 z-[9999] block pt-2",
			inline: "relative top-0 z-auto",
			inner: "inline-block rounded bg-white p-4 shadow-lg",
		},
		header: {
			base: "",
			title: "px-2 py-3 text-center font-semibold text-gray-900",
			selectors: {
				base: "mb-2 flex justify-between",
				button: {
					base: "rounded bg-white px-5 py-2.5 text-sm font-semibold text-gray-900 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-gray-200",
					prev: "",
					next: "",
					view: "",
				},
			},
		},
		view: {
			base: "p-1",
		},
		footer: {
			base: "mt-2 flex space-x-2",
			button: {
				base: "w-full rounded-lg px-5 py-2 text-center text-sm font-medium focus:ring-4 focus:ring-cyan-300",
				today: "bg-cyan-700 text-white hover:bg-cyan-800",
				clear: "border border-gray-300 bg-white text-gray-900 hover:bg-gray-100",
			},
		},
	},
	views: {
		days: {
			header: {
				base: "mb-1 grid grid-cols-7",
				title: "h-6 text-center text-sm font-medium leading-6 text-gray-500",
			},
			items: {
				base: "grid w-64 grid-cols-7",
				item: {
					base: "block flex-1 cursor-pointer rounded-lg border-0 text-center text-sm font-semibold leading-9 text-gray-900 hover:bg-gray-100",
					selected: "bg-primary text-white hover:bg-primary-dark",
					disabled: "text-gray-600",
				},
			},
		},
		months: {
			items: {
				base: "grid w-64 grid-cols-4",
				item: {
					base: "block flex-1 cursor-pointer rounded-lg border-0 text-center text-sm font-semibold leading-9 text-gray-900 hover:bg-gray-100",
					selected: "bg-primary text-white hover:bg-primary-dark",
					disabled: "text-gray-600",
				},
			},
		},
		years: {
			items: {
				base: "grid w-64 grid-cols-4",
				item: {
					base: "block flex-1 cursor-pointer rounded-lg border-0 text-center text-sm font-semibold leading-9 text-gray-900 hover:bg-gray-100",
					selected: "bg-primary text-white hover:bg-primary-dark",
					disabled: "text-gray-500",
				},
			},
		},
		decades: {
			items: {
				base: "grid w-64 grid-cols-4",
				item: {
					base: "block flex-1 cursor-pointer rounded-lg border-0 text-center text-sm font-semibold leading-9 text-gray-900 hover:bg-gray-100",
					selected: "bg-primary text-white hover:bg-primary-dark",
					disabled: "text-gray-500",
				},
			},
		},
	},
	input: {
		base: "!appearance-none !border !rounded-sm !w-full !py-2 !px-3 !text-gray-700 !leading-tight !focus:outline-none !focus:ring-1 !focus:ring-primary !focus:border-primary !bg-white !text-sm",
		disabled: "cursor-not-allowed",
		error: "!border-red-500 !focus:border-red-500 !focus:ring-red-500",
	},
}

const DateTimePicker = React.forwardRef<HTMLDivElement, DateTimePickerProps>(
	({ label, value, onChange, error, disableFuture, yearOnly, className, disabled, ...rest }, ref) => {
		const handleChange = (date: Date | null) => {
			if (date) {
				// Crea una data UTC direttamente utilizzando i componenti anno, mese, giorno
				// senza fare conversioni di fuso orario
				const year = date.getFullYear()
				const month = date.getMonth()
				const day = date.getDate()

				// Crea la data direttamente in UTC
				const utcDate = new Date(Date.UTC(year, month, day, 0, 0, 0, 0))
				const formattedDate = moment.utc(utcDate).format("YYYY-MM-DDTHH:mm:ss.SSS[Z]")
				onChange(formattedDate)
			} else {
				onChange(null)
			}
		}

		// Migliora la gestione della conversione della data
		const getDateValue = () => {
			if (!value) {
				return undefined
			}

			// Se è già una Date, usala direttamente
			if (Object.prototype.toString.call(value) === "[object Date]") {
				return value as unknown as Date
			}

			// Se è una stringa, prova a parsarla
			if (typeof value === "string") {
				const parsedDate = moment(value).toDate()

				// Verifica se la data è valida
				if (moment(value).isValid()) {
					return parsedDate
				} else {
					console.error("DateTimePicker - Data non valida:", value)
					return undefined
				}
			}

			console.warn("DateTimePicker - Formato valore non riconosciuto:", value)
			return undefined
		}

		// Genera una key unica basata sul valore per forzare il re-render
		const datepickerKey = value ? `datepicker-${value}` : "datepicker-empty"

		useEffect(() => {
			// Applica gli stili direttamente all'input dopo il render
			const applyCustomStyles = () => {
				const input = document.querySelector(".custom-datepicker input") as HTMLInputElement

				if (input) {
					// Reset di tutti gli stili
					input.style.cssText = ""

					// Applica i nostri stili personalizzati
					input.style.appearance = "none"
					input.style.border = `1px solid ${error ? "#ef4444" : "#d1d5db"}`
					input.style.borderRadius = "0.300rem"
					input.style.width = "100%"
					input.style.padding = "0.5rem 0.75rem"
					input.style.color = "#374151"
					input.style.lineHeight = "1.25"
					input.style.backgroundColor = "white"
					input.style.fontSize = "1rem"
					input.style.boxShadow = "none"

					// Imposta il placeholder e pulisce il valore quando non c'è un valore
					if (!value && !disabled) {
						input.setAttribute("placeholder", "Seleziona data")
						// Forza l'input a essere vuoto quando non c'è un valore
						if (input.value) {
							input.value = ""
						}
					} else {
						input.removeAttribute("placeholder")
					}

					// Applica stili per stato disabilitato
					if (disabled) {
						input.style.opacity = "90"
						input.style.color = "#6B7280"
						input.style.backgroundColor = "#f8fafc"
					}

					// Gestisce il focus solo se non disabilitato
					if (!disabled) {
						const handleFocus = () => {
							if (input) {
								input.style.outline = "none"
								input.style.borderColor = error ? "#ef4444" : "#febe10"
								input.style.boxShadow = `0 0 0 1px ${error ? "#ef4444" : "#febe10"}`
							}
						}

						const handleBlur = () => {
							if (input) {
								input.style.borderColor = error ? "#ef4444" : "#d1d5db"
								input.style.boxShadow = "none"
							}
						}

						input.addEventListener("focus", handleFocus)
						input.addEventListener("blur", handleBlur)

						return () => {
							input.removeEventListener("focus", handleFocus)
							input.removeEventListener("blur", handleBlur)
						}
					}
				}
			}

			// Applica gli stili immediatamente e dopo un breve delay per assicurarsi che il componente sia renderizzato
			applyCustomStyles()
			const timeoutId = setTimeout(applyCustomStyles, 100)

			return () => clearTimeout(timeoutId)
		}, [error, value, disabled]) // Riapplica quando cambiano errore, valore o stato disabled

		const dateValue = getDateValue()

		return (
			<div className={`w-full ${className || ""}`}>
				{label && <label className="form-label">{label}</label>}
				<div ref={ref} className="custom-datepicker">
					<Datepicker
						key={datepickerKey}
						onChange={handleChange}
						{...(dateValue !== undefined ? { value: dateValue } : {})}
						maxDate={disableFuture ? new Date() : undefined}
						theme={theme}
						language="it"
						weekStart={1}
						labelTodayButton="Oggi"
						labelClearButton="Cancella"
						disabled={disabled}
						{...rest}
					/>
					<style>{`
            .custom-datepicker .pointer-events-none svg {
              display:none !important;
            }

            .custom-datepicker input {
              border-radius: 0.300rem;
              padding: 0.5rem 0.75rem;
              background-color: white;
            }

            .custom-datepicker input::placeholder {
              color: #9ca3af;
              opacity: 1;
            }

            .custom-datepicker input:focus {
              border-color: #febe10;
              box-shadow: 0 0 0 1px #febe10;
              position: relative;
              top: 0;
              left: 0;
              width: 100%;
              height: 100%;
              z-index: 999;
            }
          `}</style>
				</div>
				{error && <p className="text-red-500 text-xs mt-1">{error.message}</p>}
			</div>
		)
	}
)

DateTimePicker.displayName = "DateTimePicker"

export default DateTimePicker
