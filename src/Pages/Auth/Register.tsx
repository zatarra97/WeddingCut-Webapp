import { useNavigate, Link } from "react-router-dom"
import { toast } from "react-toastify"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import logoOrizzontale from "../../Images/horizzontal.png"
import Input from "../../Components/Input"
import AuthLayout from "../../Components/AuthLayout"
import { cognitoService } from "../../services/cognito"
import {
	registrationSchema,
	confirmRegistrationSchema,
	type RegistrationFormData,
	type ConfirmRegistrationFormData,
} from "./registrationSchema"
import { useState } from "react"
import "./Auth.css"

type RegisterView = "register" | "confirmCode" | "success"

const Register: React.FC = () => {
	const navigate = useNavigate()
	const [loading, setLoading] = useState(false)
	const [confirmLoading, setConfirmLoading] = useState(false)
	const [currentView, setCurrentView] = useState<RegisterView>("register")
	const [registeredEmail, setRegisteredEmail] = useState("")

	const onRegister = async (data: RegistrationFormData) => {
		setLoading(true)
		try {
			await cognitoService.signUp({
				email: data.email,
				password: data.password,
				nomeCompleto: data.nomeCompleto,
				telefono: data.telefono,
			})
			setRegisteredEmail(data.email)
			setCurrentView("confirmCode")
			toast.success("Controlla la tua email per il codice di verifica.")
		} catch (err: any) {
			if (err.name === "UsernameExistsException") {
				toast.error("Un account con questa email esiste già. Accedi o recupera la password.")
			} else if (err.name === "InvalidParameterException" && err.message?.includes("phone")) {
				toast.error("Numero di telefono non valido. Usa il formato internazionale (es. +393331234567).")
			} else {
				toast.error(err.message || "Errore durante la registrazione.")
			}
		} finally {
			setLoading(false)
		}
	}

	const onConfirmCode = async (data: ConfirmRegistrationFormData) => {
		setConfirmLoading(true)
		try {
			await cognitoService.confirmSignUp(registeredEmail, data.code)
			setCurrentView("success")
			toast.success("Account confermato. Puoi accedere.")
		} catch (err: any) {
			if (err.name === "CodeMismatchException") {
				toast.error("Codice non valido. Controlla l'email e riprova.")
			} else if (err.name === "ExpiredCodeException") {
				toast.error("Codice scaduto. Richiedi un nuovo codice dalla pagina di login.")
			} else {
				toast.error(err.message || "Errore durante la conferma.")
			}
		} finally {
			setConfirmLoading(false)
		}
	}

	const goToLogin = () => navigate("/accesso/login")

	if (currentView === "success") {
		return (
			<AuthLayout logo={logoOrizzontale}>
				<div className="text-center space-y-6">
					<div className="auth-success-icon inline-flex items-center justify-center w-20 h-20 rounded-full bg-linear-to-br from-emerald-400 to-emerald-600 text-white shadow-lg shadow-emerald-500/30">
						<i className="fa-solid fa-check text-3xl" />
					</div>
					<div className="space-y-1">
						<h1 className="text-2xl font-bold text-slate-900 tracking-tight">Registrazione completata</h1>
						<p className="text-sm text-slate-500">Il tuo account è attivo. Accedi con email e password.</p>
					</div>
					<button
						type="button"
						onClick={goToLogin}
						className="auth-btn-primary w-full flex items-center justify-center gap-2 rounded-xl py-3.5 text-sm cursor-pointer"
					>
						Vai al login <i className="fa-solid fa-arrow-right" />
					</button>
				</div>
			</AuthLayout>
		)
	}

	if (currentView === "confirmCode") {
		return (
			<AuthLayout logo={logoOrizzontale}>
				<ConfirmCodeForm
					email={registeredEmail}
					onConfirm={onConfirmCode}
					onBack={() => setCurrentView("register")}
					loading={confirmLoading}
				/>
			</AuthLayout>
		)
	}

	return (
		<AuthLayout logo={logoOrizzontale} wide>
			<RegisterForm onRegister={onRegister} loading={loading} />
		</AuthLayout>
	)
}

interface RegisterFormProps {
	onRegister: (data: RegistrationFormData) => void
	loading: boolean
}

const RegisterForm: React.FC<RegisterFormProps> = ({ onRegister, loading }) => {
	const {
		register,
		handleSubmit,
		formState: { errors },
	} = useForm<RegistrationFormData>({
		resolver: zodResolver(registrationSchema),
		mode: "onChange",
		defaultValues: {
			nomeCompleto: "",
			telefono: "",
			email: "",
			password: "",
			confirmPassword: "",
		},
	})

	return (
		<div className="space-y-8">
			<div className="space-y-1 text-center">
				<h1 className="text-2xl font-bold text-slate-900 tracking-tight">Crea account</h1>
				<p className="text-sm text-slate-500">Compila i campi. Riceverai un codice di verifica via email.</p>
			</div>
			<form className="space-y-4" onSubmit={handleSubmit(onRegister)}>
				<div className="auth-input-wrap">
					<Input label="Nome completo" type="text" {...register("nomeCompleto")} error={errors.nomeCompleto ? { message: errors.nomeCompleto.message ?? "" } : undefined} />
				</div>
				<div className="auth-input-wrap">
					<Input label="Telefono" type="tel" placeholder="+393331234567" {...register("telefono")} error={errors.telefono ? { message: errors.telefono.message ?? "" } : undefined} />
				</div>
				<div className="auth-input-wrap">
					<Input label="Email" type="email" {...register("email")} error={errors.email ? { message: errors.email.message ?? "" } : undefined} />
				</div>
				<div className="auth-input-wrap">
					<Input label="Password" type="password" {...register("password")} error={errors.password ? { message: errors.password.message ?? "" } : undefined} />
				</div>
				<div className="auth-input-wrap">
					<Input label="Conferma password" type="password" {...register("confirmPassword")} error={errors.confirmPassword ? { message: errors.confirmPassword.message ?? "" } : undefined} />
				</div>
				<button
					type="submit"
					className="auth-btn-primary mt-6 w-full flex items-center justify-center gap-2 rounded-xl py-3.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 disabled:opacity-70 disabled:cursor-not-allowed cursor-pointer"
					disabled={loading}
				>
					{loading ? <><i className="fa-solid fa-spinner fa-spin" /> Registrazione in corso...</> : <><i className="fa-solid fa-user-plus" /> Registrati</>}
				</button>
			</form>
			<div className="text-center pt-2 border-t border-slate-100">
				<Link to="/accesso/login" className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-[#032b36] transition-colors">
					<i className="fas fa-arrow-left" /> Hai già un account? <span className="text-primary-dark">Accedi</span>
				</Link>
			</div>
		</div>
	)
}

interface ConfirmCodeFormProps {
	email: string
	onConfirm: (data: ConfirmRegistrationFormData) => void
	onBack: () => void
	loading: boolean
}

const ConfirmCodeForm: React.FC<ConfirmCodeFormProps> = ({ email, onConfirm, onBack, loading }) => {
	const {
		register,
		handleSubmit,
		formState: { errors },
	} = useForm<ConfirmRegistrationFormData>({
		resolver: zodResolver(confirmRegistrationSchema),
		mode: "onChange",
		defaultValues: { code: "" },
	})

	return (
		<div className="space-y-8">
			<div className="space-y-1 text-center">
				<h1 className="text-2xl font-bold text-slate-900 tracking-tight">Verifica email</h1>
				<p className="text-sm text-slate-500">Inserisci il codice di 6 caratteri ricevuto via email.</p>
				<p className="text-xs text-slate-400 mt-1">Inviato a: <span className="font-medium text-slate-600">{email}</span></p>
			</div>
			<form className="space-y-5" onSubmit={handleSubmit(onConfirm)}>
				<div className="auth-input-wrap">
					<Input label="Codice di verifica" type="text" maxLength={6} placeholder="000000" {...register("code")} error={errors.code ? { message: errors.code.message ?? "" } : undefined} />
				</div>
				<button
					type="submit"
					className="auth-btn-primary mt-6 w-full flex items-center justify-center gap-2 rounded-xl py-3.5 text-sm disabled:opacity-70 cursor-pointer"
					disabled={loading}
				>
					{loading ? <><i className="fa-solid fa-spinner fa-spin" /> Verifica in corso...</> : <><i className="fa-solid fa-check" /> Conferma</>}
				</button>
			</form>
			<button type="button" onClick={onBack} className="w-full text-sm text-slate-500 hover:text-primary-dark flex items-center justify-center gap-1.5 transition-colors" disabled={loading}>
				<i className="fas fa-arrow-left" /> Torna alla registrazione
			</button>
		</div>
	)
}

export default Register
