import React, { useState } from "react"
import { CognitoUser, AuthenticationDetails, CognitoUserPool, CognitoUserSession } from "amazon-cognito-identity-js"
import { useNavigate, useLocation, Link } from "react-router-dom"
import { toast } from "react-toastify"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import logoOrizzontale from "../../Images/horizzontal.png"
import Input from "../../Components/Input"
import AuthLayout from "../../Components/AuthLayout"
import { LOCAL_STORAGE_KEYS, VALID_COGNITO_GROUPS, GROUP_TO_ROLE_MAP, DEFAULT_ROUTE_BY_ROLE } from "../../constants"
import "./Auth.css"
import {
	loginSchema,
	resetPasswordSchema,
	forgotPasswordSchema,
	confirmCodeSchema,
	type LoginFormData,
	type ResetPasswordFormData,
	type ForgotPasswordFormData,
	type ConfirmCodeFormData,
} from "./loginSchema"

interface LoginPageProps {
	setIsAuthenticated: (value: boolean) => void
	setUser: (user: CognitoUser) => void
	setUserRole: (role: string | null) => void
}

interface LoginFormProps {
	onLogin: (data: LoginFormData) => void
	onForgotPassword: () => void
	loading: boolean
}

interface ResetFormProps {
	onResetPassword: (data: ResetPasswordFormData) => void
	resetLoading: boolean
}

interface ForgotPasswordFormProps {
	onSendCode: (data: ForgotPasswordFormData) => void
	onBackToLogin: () => void
	loading: boolean
}

interface ConfirmCodeFormProps {
	onConfirmCode: (data: ConfirmCodeFormData) => void
	onBackToForgotPassword: () => void
	email: string
	loading: boolean
}

interface ResetUserData {
	cognitoUser: CognitoUser
	userAttributes: unknown
	requiredAttributes: unknown
}

type LoginView = "login" | "reset" | "forgotPassword" | "confirmCode"

const LoginPage: React.FC<LoginPageProps> = ({ setIsAuthenticated, setUser, setUserRole }) => {
	const navigate = useNavigate()
	const location = useLocation()
	const searchParams = new URLSearchParams(location.search)
	const returnUrl = searchParams.get("returnUrl") || localStorage.getItem(LOCAL_STORAGE_KEYS.RETURN_URL) || "/"
	const [loading, setLoading] = useState(false)
	const [resetLoading, setResetLoading] = useState(false)
	const [forgotPasswordLoading, setForgotPasswordLoading] = useState(false)
	const [confirmCodeLoading, setConfirmCodeLoading] = useState(false)
	const [currentView, setCurrentView] = useState<LoginView>("login")
	const [resetUserData, setResetUserData] = useState<ResetUserData | null>(null)
	const [forgotPasswordEmail, setForgotPasswordEmail] = useState("")

	const poolData = {
		UserPoolId: import.meta.env.VITE_COGNITO_USER_POOL_ID || "",
		ClientId: import.meta.env.VITE_COGNITO_CLIENT_ID || "",
	}
	const userPool = new CognitoUserPool(poolData)

	const onLogin = async (data: LoginFormData) => {
		setLoading(true)
		const { username, password } = data

		const authenticationDetails = new AuthenticationDetails({ Username: username, Password: password })
		const cognitoUser = new CognitoUser({ Username: username, Pool: userPool })

		try {
			const result = await new Promise<CognitoUserSession>((resolve, reject) => {
				cognitoUser.authenticateUser(authenticationDetails, {
					onSuccess: resolve,
					onFailure: reject,
					newPasswordRequired: (userAttributes, requiredAttributes) => {
						setResetUserData({ cognitoUser, userAttributes, requiredAttributes })
						setCurrentView("reset")
					},
				})
			})

			setCurrentView("login")
			const idToken = result.getIdToken().getJwtToken()
			const accessToken = result.getAccessToken().getJwtToken()

			localStorage.setItem(LOCAL_STORAGE_KEYS.ID_TOKEN, idToken)
			localStorage.setItem(LOCAL_STORAGE_KEYS.ACCESS_TOKEN, accessToken)
			localStorage.setItem(LOCAL_STORAGE_KEYS.USER_EMAIL, username)

			const payload = JSON.parse(atob(idToken.split('.')[1]))
			const groups: string[] = payload['cognito:groups'] ?? []
			const group = groups.find(g => (VALID_COGNITO_GROUPS as readonly string[]).includes(g))
			const role = group ? GROUP_TO_ROLE_MAP[group] : null
			if (role) {
				localStorage.setItem(LOCAL_STORAGE_KEYS.USER_ROLE, role)
				setUserRole(role)
			}

			setIsAuthenticated(true)
			setUser(cognitoUser)
			const defaultRoute = role ? (DEFAULT_ROUTE_BY_ROLE[role] ?? '/dashboard') : '/dashboard'
			navigate(returnUrl && returnUrl !== '/' ? returnUrl : defaultRoute)
			localStorage.removeItem(LOCAL_STORAGE_KEYS.RETURN_URL)
		} catch (err: unknown) {
			const error = err as { name?: string; message?: string }
			if (error.name === "NotAuthorizedException") {
				toast.error("Email o password non corretti.")
			} else if (error.name === "UserNotConfirmedException") {
				toast.error("Account non ancora confermato. Controlla l'email per il codice di verifica.")
			} else {
				toast.error(error.message ? `Errore: ${error.message}` : "Errore di accesso.")
			}
		} finally {
			setLoading(false)
		}
	}

	const onResetPassword = async (data: ResetPasswordFormData) => {
		setResetLoading(true)
		try {
			await new Promise((resolve, reject) => {
				resetUserData?.cognitoUser.completeNewPasswordChallenge(data.newPassword, {}, { onSuccess: resolve, onFailure: reject })
			})
			toast.success("Password impostata. Accedi con la nuova password.")
			const email = resetUserData?.cognitoUser.getUsername()
			setResetUserData(null)
			setCurrentView("login")
			if (email) onLogin({ username: email, password: data.newPassword })
		} catch (error: unknown) {
			const err = error as { name?: string; message?: string }
			toast.error(err.name === "InvalidPasswordException" ? "Password non valida. Usa maiuscole, minuscole, numeri e caratteri speciali." : (err.message ?? "Errore."))
		} finally {
			setResetLoading(false)
		}
	}

	const onSendForgotPasswordCode = async (data: ForgotPasswordFormData) => {
		setForgotPasswordLoading(true)
		const cognitoUser = new CognitoUser({ Username: data.email, Pool: userPool })
		try {
			await new Promise((resolve, reject) => {
				cognitoUser.forgotPassword({
					onSuccess: () => {
						setForgotPasswordEmail(data.email)
						setCurrentView("confirmCode")
						toast.success("Codice inviato alla tua email.")
						resolve(true)
					},
					onFailure: reject,
				})
			})
		} catch (error: unknown) {
			const err = error as { name?: string; message?: string }
			if (err.name === "UserNotFoundException") toast.error("Nessun account con questa email.")
			else if (err.name === "LimitExceededException") toast.error("Troppi tentativi. Riprova più tardi.")
			else toast.error(err.message ?? "Errore nell'invio del codice.")
		} finally {
			setForgotPasswordLoading(false)
		}
	}

	const onConfirmForgotPasswordCode = async (data: ConfirmCodeFormData) => {
		setConfirmCodeLoading(true)
		const cognitoUser = new CognitoUser({ Username: forgotPasswordEmail, Pool: userPool })
		try {
			await new Promise((resolve, reject) => {
				cognitoUser.confirmPassword(data.code, data.newPassword, { onSuccess: () => resolve(true), onFailure: reject })
			})
			toast.success("Password reimpostata. Ora puoi accedere.")
			setCurrentView("login")
			setForgotPasswordEmail("")
		} catch (error: unknown) {
			const err = error as { name?: string; message?: string }
			if (err.name === "CodeMismatchException") toast.error("Codice non valido.")
			else if (err.name === "ExpiredCodeException") toast.error("Codice scaduto. Richiedi un nuovo codice.")
			else toast.error(err.message ?? "Errore.")
		} finally {
			setConfirmCodeLoading(false)
		}
	}

	const renderCurrentView = () => {
		switch (currentView) {
			case "login":
				return <LoginForm onLogin={onLogin} onForgotPassword={() => setCurrentView("forgotPassword")} loading={loading} />
			case "reset":
				return <ResetForm onResetPassword={onResetPassword} resetLoading={resetLoading} />
			case "forgotPassword":
				return <ForgotPasswordForm onSendCode={onSendForgotPasswordCode} onBackToLogin={() => { setCurrentView("login"); setForgotPasswordEmail("") }} loading={forgotPasswordLoading} />
			case "confirmCode":
				return (
					<ConfirmCodeForm
						onConfirmCode={onConfirmForgotPasswordCode}
						onBackToForgotPassword={() => setCurrentView("forgotPassword")}
						email={forgotPasswordEmail}
						loading={confirmCodeLoading}
					/>
				)
			default:
				return <LoginForm onLogin={onLogin} onForgotPassword={() => setCurrentView("forgotPassword")} loading={loading} />
		}
	}

	return (
		<AuthLayout logo={logoOrizzontale}>
			{renderCurrentView()}
		</AuthLayout>
	)
}

const LoginForm: React.FC<LoginFormProps> = ({ onLogin, onForgotPassword, loading }) => {
	const { register, handleSubmit, formState: { errors } } = useForm<LoginFormData>({
		resolver: zodResolver(loginSchema),
		mode: "onChange",
		defaultValues: { username: "", password: "" },
	})

	return (
		<div className="space-y-8">
			<div className="space-y-1 text-center">
				<h1 className="text-2xl font-bold text-slate-900 tracking-tight">Accedi</h1>
				<p className="text-sm text-slate-500">Inserisci email e password per continuare.</p>
			</div>
			<form className="space-y-5" onSubmit={handleSubmit(onLogin)}>
				<div className="auth-input-wrap">
					<Input label="Email" type="email" {...register("username")} error={errors.username ? { message: errors.username.message ?? "" } : undefined} />
				</div>
				<div className="auth-input-wrap">
					<Input label="Password" type="password" {...register("password")} error={errors.password ? { message: errors.password.message ?? "" } : undefined} />
				</div>
				<button
					type="submit"
					className="auth-btn-primary mt-6 w-full flex items-center justify-center gap-2 rounded-xl py-3.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 disabled:opacity-70 disabled:cursor-not-allowed cursor-pointer"
					disabled={loading}
				>
					{loading ? <><i className="fa-solid fa-spinner fa-spin" /> Caricamento</> : <><i className="fa-solid fa-arrow-right" /> Accedi</>}
				</button>
			</form>
			<div className="text-center space-y-3 pt-2 border-t border-slate-100">
				<button type="button" onClick={onForgotPassword} className="block w-full text-sm text-slate-500 hover:text-primary-dark transition-colors cursor-pointer" disabled={loading}>
					Ho dimenticato la password
				</button>
				<Link to="/accesso/registrati" className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-[#032b36] transition-colors">
					Non hai un account? <span className="text-primary-dark">Registrati</span>
				</Link>
			</div>
		</div>
	)
}

const ForgotPasswordForm: React.FC<ForgotPasswordFormProps> = ({ onSendCode, onBackToLogin, loading }) => {
	const { register, handleSubmit, formState: { errors } } = useForm<ForgotPasswordFormData>({
		resolver: zodResolver(forgotPasswordSchema),
		mode: "onChange",
		defaultValues: { email: "" },
	})
	return (
		<div className="space-y-8">
			<div className="space-y-1 text-center">
				<h1 className="text-2xl font-bold text-slate-900 tracking-tight">Recupero password</h1>
				<p className="text-sm text-slate-500">Inserisci l'email per ricevere il codice.</p>
			</div>
			<form className="space-y-5" onSubmit={handleSubmit(onSendCode)}>
				<div className="auth-input-wrap">
					<Input label="Email" type="email" {...register("email")} error={errors.email ? { message: errors.email.message ?? "" } : undefined} />
				</div>
				<button type="submit" className="auth-btn-primary mt-6 w-full flex items-center justify-center gap-2 rounded-xl py-3.5 text-sm disabled:opacity-70 cursor-pointer" disabled={loading}>
					{loading ? <><i className="fa-solid fa-spinner fa-spin" /> Invio...</> : <><i className="fa-solid fa-paper-plane" /> Invia codice</>}
				</button>
			</form>
			<button type="button" onClick={onBackToLogin} className="w-full text-sm text-slate-500 hover:text-primary-dark flex items-center justify-center gap-1.5 transition-colors" disabled={loading}>
				<i className="fas fa-arrow-left" /> Torna al login
			</button>
		</div>
	)
}

const ConfirmCodeForm: React.FC<ConfirmCodeFormProps> = ({ onConfirmCode, onBackToForgotPassword, email, loading }) => {
	const { register, handleSubmit, formState: { errors } } = useForm<ConfirmCodeFormData>({
		resolver: zodResolver(confirmCodeSchema),
		mode: "onChange",
		defaultValues: { code: "", newPassword: "", confirmPassword: "" },
	})
	return (
		<div className="space-y-8">
			<div className="space-y-1 text-center">
				<h1 className="text-2xl font-bold text-slate-900 tracking-tight">Nuova password</h1>
				<p className="text-sm text-slate-500">Codice e nuova password ricevuti via email.</p>
				<p className="text-xs text-slate-400 mt-1">Inviato a: <span className="font-medium text-slate-600">{email}</span></p>
			</div>
			<form className="space-y-5" onSubmit={handleSubmit(onConfirmCode)}>
				<div className="auth-input-wrap">
					<Input label="Codice" type="text" {...register("code")} error={errors.code ? { message: errors.code.message ?? "" } : undefined} />
				</div>
				<div className="auth-input-wrap">
					<Input label="Nuova password" type="password" {...register("newPassword")} error={errors.newPassword ? { message: errors.newPassword.message ?? "" } : undefined} />
				</div>
				<div className="auth-input-wrap">
					<Input label="Conferma password" type="password" {...register("confirmPassword")} error={errors.confirmPassword ? { message: errors.confirmPassword.message ?? "" } : undefined} />
				</div>
				<button type="submit" className="auth-btn-primary mt-6 w-full flex items-center justify-center gap-2 rounded-xl py-3.5 text-sm disabled:opacity-70 cursor-pointer" disabled={loading}>
					{loading ? <><i className="fa-solid fa-spinner fa-spin" /> Conferma...</> : <><i className="fa-solid fa-key" /> Reimposta password</>}
				</button>
			</form>
			<button type="button" onClick={onBackToForgotPassword} className="w-full text-sm text-slate-500 hover:text-primary-dark flex items-center justify-center gap-1.5 transition-colors" disabled={loading}>
				<i className="fas fa-arrow-left" /> Richiedi nuovo codice
			</button>
		</div>
	)
}

const ResetForm: React.FC<ResetFormProps> = ({ onResetPassword, resetLoading }) => {
	const { register, handleSubmit, formState: { errors } } = useForm<ResetPasswordFormData>({
		resolver: zodResolver(resetPasswordSchema),
		mode: "onChange",
		defaultValues: { newPassword: "", confirmPassword: "" },
	})
	return (
		<div className="space-y-8">
			<div className="space-y-1 text-center">
				<h1 className="text-2xl font-bold text-slate-900 tracking-tight">Imposta password</h1>
				<p className="text-sm text-slate-500">Scegli una nuova password per il tuo account.</p>
			</div>
			<form className="space-y-5" onSubmit={handleSubmit(onResetPassword)}>
				<div className="auth-input-wrap">
					<Input label="Nuova password" type="password" {...register("newPassword")} error={errors.newPassword ? { message: errors.newPassword.message ?? "" } : undefined} />
				</div>
				<div className="auth-input-wrap">
					<Input label="Conferma password" type="password" {...register("confirmPassword")} error={errors.confirmPassword ? { message: errors.confirmPassword.message ?? "" } : undefined} />
				</div>
				<button type="submit" className="auth-btn-primary mt-6 w-full flex items-center justify-center gap-2 rounded-xl py-3.5 text-sm disabled:opacity-70 cursor-pointer" disabled={resetLoading}>
					{resetLoading ? <><i className="fa-solid fa-spinner fa-spin" /> Salvataggio...</> : <><i className="fa-solid fa-check" /> Salva password</>}
				</button>
			</form>
		</div>
	)
}

export default LoginPage
