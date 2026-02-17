import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faHome, faExclamationTriangle } from '@fortawesome/free-solid-svg-icons';
import { Link } from 'react-router-dom';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center">
      <div className="container px-4">
        <div className="max-w-2xl mx-auto text-center">
          <div className="relative">

            {/* Contenuto principale */}
            <div className="relative">
              <div className="mb-8">
                <div className="inline-block p-4 rounded-full bg-primary/30 mb-6">
                  <FontAwesomeIcon 
                    icon={faExclamationTriangle} 
                    className="text-primary text-6xl"
                  />
                </div>
                <h1 className="text-5xl font-bold text-slate-900 mb-4">
                  404
                </h1>
                <h2 className="text-2xl font-semibold text-slate-900 mb-4">
                  Pagina non trovata
                </h2>
                <p className="text-slate-900 text-lg mb-8 max-w-md mx-auto">
                  La pagina che stai cercando non esiste.
                </p>
              </div>

              <Link 
                to="/"
                className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-primary hover:bg-primary-dark text-white font-semibold rounded-lg transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-primary/25"
              >
                <FontAwesomeIcon icon={faHome} className="text-lg" />
                <span>Torna alla home</span>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 