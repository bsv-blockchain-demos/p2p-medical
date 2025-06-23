
import React from 'react';
import { Button } from '@/components/ui/button';
import { Check, Send, Clear, Shield, Clock } from 'lucide-react';

interface SuccessMessageProps {
  filesCount: number;
  recipientEmail: string;
  onClearAll: () => void;
  onSendAnother: () => void;
}

export const SuccessMessage: React.FC<SuccessMessageProps> = ({
  filesCount,
  recipientEmail,
  onClearAll,
  onSendAnother,
}) => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-white to-blue-50 flex items-center justify-center px-6">
      <div className="max-w-md w-full">
        <div className="bg-white rounded-2xl shadow-xl border border-green-100 overflow-hidden">
          {/* Success Header */}
          <div className="bg-green-600 text-white px-8 py-6 text-center">
            <div className="flex justify-center mb-3">
              <div className="p-3 bg-white bg-opacity-20 rounded-full">
                <Check className="w-8 h-8" />
              </div>
            </div>
            <h2 className="text-xl font-bold">Files Sent Successfully!</h2>
          </div>

          <div className="p-8">
            {/* Success Details */}
            <div className="text-center mb-8">
              <p className="text-gray-700 mb-2">
                <span className="font-semibold">{filesCount}</span> file{filesCount !== 1 ? 's' : ''} securely shared with:
              </p>
              <p className="text-blue-600 font-medium text-lg">{recipientEmail}</p>
            </div>

            {/* Security Info */}
            <div className="bg-blue-50 rounded-lg p-4 mb-8">
              <div className="flex items-start gap-3">
                <Shield className="w-5 h-5 text-blue-600 mt-0.5" />
                <div className="text-sm">
                  <p className="font-medium text-blue-900 mb-1">Secure Transfer Complete</p>
                  <p className="text-blue-700">Files are encrypted and will be automatically deleted after 7 days.</p>
                </div>
              </div>
            </div>

            {/* Auto-deletion Notice */}
            <div className="bg-amber-50 rounded-lg p-4 mb-8">
              <div className="flex items-start gap-3">
                <Clock className="w-5 h-5 text-amber-600 mt-0.5" />
                <div className="text-sm">
                  <p className="font-medium text-amber-900 mb-1">Automatic Cleanup</p>
                  <p className="text-amber-700">The recipient has been notified and files will auto-delete in 7 days for security.</p>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="space-y-3">
              <Button
                onClick={onSendAnother}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-xl font-medium transition-colors"
                size="lg"
              >
                <Send className="w-5 h-5 mr-2" />
                Send to Another Recipient
              </Button>
              
              <Button
                onClick={onClearAll}
                variant="outline"
                className="w-full border-gray-300 text-gray-700 hover:bg-gray-50 py-3 rounded-xl font-medium transition-colors"
                size="lg"
              >
                <Clear className="w-5 h-5 mr-2" />
                Clear All Data & Start Over
              </Button>
            </div>

            {/* Privacy Note */}
            <p className="text-xs text-gray-500 text-center mt-6">
              No data is stored locally after clearing. Your privacy is protected.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
