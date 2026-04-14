import { z } from 'zod'

const optionalDecimal = z.preprocess(
	(v) => {
		if (v === '' || v === null || v === undefined) return null
		const n = Number(v)
		return isNaN(n) ? null : n
	},
	z.number().min(0, 'Deve essere ≥ 0').nullable(),
)

const optionalInt = z.preprocess(
	(v) => {
		if (v === '' || v === null || v === undefined) return null
		const n = Number(v)
		return isNaN(n) ? null : Math.floor(n)
	},
	z.number().int().min(0, 'Deve essere ≥ 0').nullable(),
)

const priceTierSchema = z.object({
	label: z.string().min(1, 'Etichetta obbligatoria'),
	price: z.preprocess(
		(v) => (v === '' || v == null ? 0 : Number(v)),
		z.number().min(0, 'Deve essere ≥ 0'),
	),
})

export const serviceSchema = z
	.object({
		name: z.string().min(1, 'Nome obbligatorio').max(200, 'Massimo 200 caratteri'),
		description: z.string().min(1, 'Descrizione obbligatoria'),
		durationDescription: z.string().max(500, 'Massimo 500 caratteri').optional(),
		category: z.enum(['main', 'extra', 'delivery'] as const, {
			message: 'Categoria obbligatoria',
		}),
		pricingType: z.enum(['fixed', 'tiered', 'percentage'] as const, {
			message: 'Tipo tariffazione obbligatorio',
		}),
		basePrice: optionalDecimal,
		percentageValue: optionalDecimal,
		priceTiers: z.array(priceTierSchema).optional(),
		restrictedToService: z.string().nullable().optional(),
		sortOrder: optionalInt,
		isActive: z.boolean(),
		discountRole: z.string().nullable().optional(),
	})
	.superRefine((data, ctx) => {
		if (data.pricingType === 'fixed' && data.basePrice == null) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				path: ['basePrice'],
				message: 'Prezzo obbligatorio',
			})
		}
		if (data.pricingType === 'percentage' && data.percentageValue == null) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				path: ['percentageValue'],
				message: 'Valore percentuale obbligatorio',
			})
		}
		if (data.pricingType === 'tiered' && (!data.priceTiers || data.priceTiers.length === 0)) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				path: ['priceTiers'],
				message: 'Almeno una fascia di prezzo richiesta',
			})
		}
	})

export type ServiceFormData = z.infer<typeof serviceSchema>

export interface PriceTier {
	label: string
	price: number
}

export interface Service {
	id: number
	publicId?: string
	name: string
	description: string
	durationDescription?: string | null
	category: 'main' | 'extra' | 'delivery'
	pricingType: 'fixed' | 'tiered' | 'percentage'
	basePrice?: number | null
	percentageValue?: number | null
	priceTiers?: PriceTier[] | null
	restrictedToService?: string | null
	sortOrder?: number | null
	isActive?: number
	discountRole?: string | null
	createdAt?: string
	updatedAt?: string
}
