import React from 'react';
import { FieldErrors, FieldError } from 'react-hook-form';

interface FormErrorsProps {
  errors: FieldErrors;
  className?: string;
}

const FormErrors: React.FC<FormErrorsProps> = ({ errors, className = '' }) => {
  if (Object.keys(errors).length === 0) return null;

  return (
    <div className={`mb-4 p-4 bg-red-50 border border-red-200 rounded-lg ${className}`}>
      <h3 className="text-red-800 font-bold mb-2">Errori di validazione:</h3>
      <ul className="list-disc list-inside">
        {Object.entries(errors).map(([key, error]) => {
          const errorMessage = (error as FieldError)?.message || 'Errore di validazione';
          return (
            <li key={key} className="text-red-600">
              <strong>{key}:</strong> {errorMessage}
            </li>
          );
        })}
      </ul>
    </div>
  );
};

export default FormErrors; 