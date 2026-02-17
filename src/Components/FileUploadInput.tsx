import { useRef, useState } from "react"
import { toast } from "react-toastify"

type AllowedContentType = "application/pdf" | "image/jpeg" | "image/png"

interface FileUploadInputProps {
	label?: string
	value?: string | null
	onChange: (s3Path: string | null) => void
	onUpload: (file: File, contentType: AllowedContentType) => Promise<string | undefined>
	onDownload?: () => Promise<void>
	error?: {
		message?: string
	}
	info?: string
	disabled?: boolean
	maxSizeMb?: number
}

const resolveContentType = (file: File): AllowedContentType | null => {
	if (file.type === "application/pdf") return "application/pdf"
	if (file.type === "image/jpeg" || file.type === "image/jpg") return "image/jpeg"
	if (file.type === "image/png") return "image/png"

	const fileName = file.name.toLowerCase()
	if (fileName.endsWith(".pdf")) return "application/pdf"
	if (fileName.endsWith(".jpeg") || fileName.endsWith(".jpg")) return "image/jpeg"
	if (fileName.endsWith(".png")) return "image/png"
	return null
}

const getFileLabel = (s3Path: string | null | undefined) => {
	if (!s3Path) return "Nessun file selezionato"
	return s3Path.split("/").pop() || s3Path
}

const FileUploadInput = ({
	label,
	value,
	onChange,
	onUpload,
	onDownload,
	error,
	info,
	disabled,
	maxSizeMb = 10,
}: FileUploadInputProps) => {
	const fileInputRef = useRef<HTMLInputElement>(null)
	const [isUploading, setIsUploading] = useState(false)
	const [isDownloading, setIsDownloading] = useState(false)
	const [localError, setLocalError] = useState<string | null>(null)

	const handleOpenPicker = () => {
		if (!disabled && !isUploading) {
			fileInputRef.current?.click()
		}
	}

	const handleRemove = (event: React.MouseEvent) => {
		event.preventDefault()
		event.stopPropagation()
		if (disabled || isUploading) return
		setLocalError(null)
		onChange(null)
		if (fileInputRef.current) {
			fileInputRef.current.value = ""
		}
	}

	const handleFileChange = async (file: File | null) => {
		if (!file) return
		setLocalError(null)

		const contentType = resolveContentType(file)
		if (!contentType) {
			setLocalError("Formato file non supportato. Usa PNG, JPG, JPEG o PDF")
			return
		}

		if (file.size > maxSizeMb * 1024 * 1024) {
			setLocalError(`Il file è troppo grande. Dimensione massima: ${maxSizeMb}MB`)
			return
		}

		try {
			setIsUploading(true)
			const s3Path = await onUpload(file, contentType)
			if (!s3Path) {
				throw new Error("Nessun percorso S3 restituito")
			}
			onChange(s3Path)
			if (fileInputRef.current) {
				fileInputRef.current.value = ""
			}
		} catch (uploadError: any) {
			console.error("Errore upload file:", uploadError)
			toast.error(uploadError.response?.data?.error?.message || "Errore nel caricamento del file")
		} finally {
			setIsUploading(false)
		}
	}

	const handleDownload = async (event: React.MouseEvent) => {
		event.preventDefault()
		event.stopPropagation()
		if (!onDownload || disabled || isUploading || isDownloading) return
		try {
			setIsDownloading(true)
			await onDownload()
		} catch (downloadError: any) {
			console.error("Errore download file:", downloadError)
			toast.error(downloadError.response?.data?.error?.message || "Errore nel download del file")
		} finally {
			setIsDownloading(false)
		}
	}

	const errorMessage = localError || error?.message

	return (
		<div className="">
			{label && (
				<label className="form-label">
					<div className="flex items-center gap-2">
						{label}
						{info && (
							<div className="relative group">
								<i className="fa-solid fa-circle-info text-gray-400 hover:text-gray-600 text-sm cursor-help"></i>
								<div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 hidden group-hover:block w-56 p-2 bg-gray-800 text-white text-sm rounded shadow-lg z-50">
									{info}
									<div className="absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-gray-800"></div>
								</div>
							</div>
						)}
					</div>
				</label>
			)}
			<div
				className={`appearance-none border rounded w-full py-2 px-3 leading-tight focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary bg-white form-input flex items-center gap-3 ${
					errorMessage ? "border-red-500 focus:ring-1" : "border-gray-300"
				} ${disabled || isUploading || isDownloading ? " text-gray-900 bg-slate-50 cursor-not-allowed" : ""}`}
				style={
					disabled || isUploading || isDownloading
						? {
								color: "#6B7280",
								backgroundColor: "#f8fafc",
						  }
						: undefined
				}
			>
				<span className="flex-1 min-w-0 text-sm text-gray-700 truncate">{getFileLabel(value)}</span>
				<div className="flex items-center gap-2">
					{value && onDownload && (
						<button
							type="button"
							onClick={handleDownload}
							disabled={disabled || isUploading || isDownloading}
							className="text-emerald-600 hover:text-emerald-700 text-sm cursor-pointer disabled:text-gray-400 disabled:cursor-not-allowed"
							title="Scarica file"
						>
							<i className={`fa-solid ${isDownloading ? "fa-spinner fa-spin" : "fa-download"}`}></i>
						</button>
					)}
					{value && !disabled && !isUploading && !isDownloading && (
						<button
							type="button"
							onClick={handleRemove}
							className="text-red-600 hover:text-red-700 text-sm cursor-pointer"
							title="Rimuovi file"
						>
							<i className="fa-solid fa-trash"></i>
						</button>
					)}
					<button
						type="button"
						onClick={handleOpenPicker}
						disabled={disabled || isUploading || isDownloading}
						className="text-sm text-primary hover:text-primary-dark cursor-pointer disabled:text-gray-400 disabled:cursor-not-allowed"
						title="Carica file"
					>
						{isUploading ? "Caricamento..." : <i className="fa-solid fa-plus"></i>}
					</button>
				</div>
				<input
					ref={fileInputRef}
					type="file"
					accept=".png,.jpg,.jpeg,.pdf"
					onChange={(event) => handleFileChange(event.target.files?.[0] || null)}
					disabled={disabled || isUploading || isDownloading}
					className="hidden"
				/>
			</div>
			{errorMessage && <p className="text-red-500 text-xs mt-1">{errorMessage}</p>}
		</div>
	)
}

export default FileUploadInput
