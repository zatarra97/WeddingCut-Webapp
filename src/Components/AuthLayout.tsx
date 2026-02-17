import React from "react"

interface AuthLayoutProps {
	children: React.ReactNode
	logo?: string
	logoAlt?: string
	wide?: boolean
}

const AuthLayout: React.FC<AuthLayoutProps> = ({ children, logo, logoAlt = "Logo", wide }) => {
	return (
		<section className="auth-page flex flex-col items-center justify-center min-h-screen px-4 py-8 md:py-12">
			<div className="auth-blob auth-blob-1" aria-hidden />
			<div className="auth-blob auth-blob-2" aria-hidden />
			<div className="auth-blob auth-blob-3" aria-hidden />

			{logo && (
				<div className="relative z-10 mb-6 md:mb-8">
					<img src={logo} alt={logoAlt} className="h-11 md:h-14 w-auto drop-shadow-sm" />
				</div>
			)}

			<div className={`auth-card w-full ${wide ? "max-w-[440px]" : "max-w-[420px]"}`}>
				<div className="auth-card-inner rounded-3xl p-8 md:p-10">
					{children}
				</div>
			</div>
		</section>
	)
}

export default AuthLayout
