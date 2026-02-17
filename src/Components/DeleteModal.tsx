interface DeleteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  title: string;
  description: string;
  isLoading: boolean;
  confirmText?: string;
}

const DeleteModal = ({ isOpen, onClose, onConfirm, title, description, isLoading, confirmText }: DeleteModalProps) => {
  if (!isOpen) return null;

  return (
    <div className="relative z-50" aria-labelledby="modal-title" role="dialog" aria-modal="true">
      <div className="fixed inset-0 bg-black/30 backdrop-blur-sm transition-opacity" onClick={onClose}></div>
      <div className="fixed inset-0 z-50 w-screen overflow-y-auto">
        <div className="flex min-h-full items-center justify-center p-4 text-center sm:p-0">
          <div className="relative transform overflow-hidden rounded-xl bg-white text-left shadow-2xl ring-1 ring-red-100 transition-all sm:my-8 sm:w-full sm:max-w-lg" onClick={(e) => e.stopPropagation()}>
            <div className="absolute right-3 top-3">
              <button
                type="button"
                aria-label="Chiudi"
                className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-gray-100 text-gray-600 hover:bg-gray-200 hover:text-gray-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-200 cursor-pointer"
                onClick={onClose}
              >
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>
            <div className="bg-white px-6 pb-6 pt-7 sm:p-8">
              <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-red-500 to-red-600 text-white ring-4 ring-red-50">
                  <i className="fa-solid fa-triangle-exclamation text-lg"></i>
                </div>
                <div className="mt-0 sm:text-left">
                  <h3 className="text-xl font-bold leading-7 text-gray-900" id="modal-title">{title}</h3>
                  <p className="mt-2 text-base text-gray-600">{description}</p>
                </div>
              </div>
              <div className="mt-6 flex justify-end gap-3">
                <button 
                  type="button" 
                  className="inline-flex min-w-24 justify-center rounded-md bg-white px-4 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 cursor-pointer"
                  onClick={onClose}
                  disabled={isLoading}
                >
                  Annulla
                </button>
                <button 
                  type="button" 
                  className={`inline-flex min-w-28 justify-center rounded-md px-4 py-2 text-sm font-semibold text-white shadow-sm cursor-pointer ${
                    isLoading ? 'bg-red-400 cursor-not-allowed' : 'bg-red-600 hover:bg-red-500'
                  }`}
                  onClick={onConfirm}
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <>
                      <i className="fa-solid fa-spinner fa-spin mr-2"></i>
                      Eliminazione in corso
                    </>
                  ) : (
                    confirmText || 'Elimina'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DeleteModal;