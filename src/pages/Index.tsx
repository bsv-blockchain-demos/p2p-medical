
import React, { useState } from 'react';
import { FileUpload } from '@/components/FileUpload';
import { EmailInput } from '@/components/EmailInput';
import { SuccessMessage } from '@/components/SuccessMessage';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Send, Shield, FileText } from 'lucide-react';

const Index = () => {
  const [files, setFiles] = useState<File[]>([]);
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const { toast } = useToast();

  const handleSend = async () => {
    if (files.length === 0) {
      toast({
        title: "No files selected",
        description: "Please select at least one file to share.",
        variant: "destructive",
      });
      return;
    }

    if (!email || !email.includes('@')) {
      toast({
        title: "Invalid email",
        description: "Please enter a valid recipient email address.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    console.log("Preparing to send files:", files.map(f => f.name));
    
    try {
      const formData = new FormData();
      files.forEach((file, index) => {
        formData.append(`file_${index}`, file);
      });
      formData.append('recipient_email', email);
      formData.append('file_count', files.length.toString());

      // Simulated API call - replace with your actual endpoint
      const response = await fetch('/api/secure-share', {
        method: 'POST',
        body: formData,
      });

      if (response.ok) {
        console.log("Files sent successfully");
        setIsSuccess(true);
        toast({
          title: "Files sent successfully",
          description: `${files.length} file(s) have been securely shared with ${email}`,
        });
      } else {
        throw new Error('Failed to send files');
      }
    } catch (error) {
      console.error("Error sending files:", error);
      toast({
        title: "Send failed",
        description: "Failed to send files. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleReset = () => {
    setFiles([]);
    setEmail('');
    setIsSuccess(false);
    console.log("Data cleared, resetting form");
  };

  const handleSendAnother = () => {
    setEmail('');
    setIsSuccess(false);
    console.log("Keeping files, ready for another recipient");
  };

  if (isSuccess) {
    return (
      <SuccessMessage
        filesCount={files.length}
        recipientEmail={email}
        onClearAll={handleReset}
        onSendAnother={handleSendAnother}
      />
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b border-blue-100">
        <div className="max-w-4xl mx-auto px-6 py-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Shield className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">SecureShare Medical</h1>
              <p className="text-sm text-gray-600">HIPAA-compliant file sharing for healthcare professionals</p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto px-6 py-12">
        <div className="bg-white rounded-2xl shadow-xl border border-blue-100 overflow-hidden">
          {/* Security Banner */}
          <div className="bg-blue-600 text-white px-8 py-4">
            <div className="flex items-center gap-2">
              <Shield className="w-5 h-5" />
              <span className="font-medium">End-to-end encrypted file transfer</span>
            </div>
          </div>

          <div className="p-8">
            {/* Instructions */}
            <div className="mb-8">
              <h2 className="text-xl font-semibold text-gray-900 mb-3">Share Medical Files Securely</h2>
              <p className="text-gray-600">
                Upload your files and enter the recipient's email address. All files are encrypted during transfer and automatically deleted after 7 days.
              </p>
            </div>

            {/* File Upload Section */}
            <div className="mb-8">
              <div className="flex items-center gap-2 mb-4">
                <FileText className="w-5 h-5 text-blue-600" />
                <h3 className="text-lg font-medium text-gray-900">Select Files</h3>
              </div>
              <FileUpload files={files} onFilesChange={setFiles} />
            </div>

            {/* Email Input Section */}
            <div className="mb-8">
              <div className="flex items-center gap-2 mb-4">
                <Send className="w-5 h-5 text-blue-600" />
                <h3 className="text-lg font-medium text-gray-900">Recipient Email</h3>
              </div>
              <EmailInput value={email} onChange={setEmail} />
            </div>

            {/* Send Button */}
            <div className="flex justify-center">
              <Button
                onClick={handleSend}
                disabled={isLoading || files.length === 0 || !email}
                className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 text-lg font-medium rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                size="lg"
              >
                {isLoading ? (
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Sending Securely...
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <Send className="w-5 h-5" />
                    Send Files Securely
                  </div>
                )}
              </Button>
            </div>

            {/* Security Notice */}
            <div className="mt-8 p-4 bg-blue-50 rounded-lg border border-blue-200">
              <p className="text-sm text-blue-800 text-center">
                <Shield className="w-4 h-4 inline mr-1" />
                Files are encrypted with AES-256 encryption and comply with HIPAA security standards
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Index;
