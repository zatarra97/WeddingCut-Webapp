import { z } from 'zod'

const optionalInt = z.preprocess(
	(v) => {
		if (v === '' || v === null || v === undefined) return null
		const n = Number(v)
		return isNaN(n) ? null : n
	},
	z.number().int().min(0, 'Deve essere ≥ 0').nullable(),
)

const optionalDecimal = z.preprocess(
	(v) => {
		if (v === '' || v === null || v === undefined) return null
		const n = Number(v)
		return isNaN(n) ? null : n
	},
	z.number().min(0, 'Deve essere ≥ 0').nullable(),
)

export const serviceSchema = z.object({
	name: z.string().min(1, 'Nome obbligatorio').max(200, 'Massimo 200 caratteri'),
	description: z.string().min(1, 'Descrizione obbligatoria'),
	durationDescription: z.string().max(500, 'Massimo 500 caratteri').optional(),
	minDuration: optionalInt,
	maxDuration: optionalInt,
	orientation: z.enum(['vertical', 'horizontal', 'both'], {
		errorMap: () => ({ message: 'Orientamento obbligatorio' }),
	}),
	priceVertical: optionalDecimal,
	priceHorizontal: optionalDecimal,
	priceBoth: optionalDecimal,
	additionalOptions: z
		.string()
		.optional()
		.refine(
			(val) => {
				if (!val || val.trim() === '') return true
				try {
					JSON.parse(val)
					return true
				} catch {
					return false
				}
			},
			{ message: 'JSON non valido' },
		),
})

export type ServiceFormData = z.infer<typeof serviceSchema>

export interface Service {
	id: number
	name: string
	description: string
	durationDescription?: string
	minDuration?: number | null
	maxDuration?: number | null
	orientation: 'vertical' | 'horizontal' | 'both'
	priceVertical?: number | null
	priceHorizontal?: number | null
	priceBoth?: number | null
	additionalOptions?: Record<string, any>
	createdAt?: string
	updatedAt?: string
}
