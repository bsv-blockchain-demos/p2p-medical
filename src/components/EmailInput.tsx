
import React from 'react';
import { Input } from '@/components/ui/input';
import { Mail } from 'lucide-react';

interface EmailInputProps {
  value: string;
  onChange: (value: string) => void;
}

export const EmailInput: React.FC<EmailInputProps> = ({ value, onChange }) => {
  const isValidEmail = value.length === 0 || value.includes('@');

  return (
    <div className="space-y-2">
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <Mail className="h-5 w-5 text-gray-400" />
        </div>
        <Input
          type="email"
          placeholder="recipient@hospital.com"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={`pl-10 py-3 text-lg border-2 transition-colors ${
            !isValidEmail 
              ? 'border-red-300 focus:border-red-500' 
              : 'border-gray-300 focus:border-blue-500'
          }`}
        />
      </div>
      {!isValidEmail && (
        <p className="text-sm text-red-600">Please enter a valid email address</p>
      )}
      <p className="text-xs text-gray-500">
        The recipient will receive a secure link to download the files
      </p>
    </div>
  );
};
