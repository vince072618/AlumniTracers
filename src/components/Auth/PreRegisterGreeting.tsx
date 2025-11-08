import React from 'react';
import { ArrowRight, ArrowLeft } from 'lucide-react';

interface PreRegisterGreetingProps {
  onNext: () => void;
  onCancel: () => void;
}

const PreRegisterGreeting: React.FC<PreRegisterGreetingProps> = ({ onNext, onCancel }) => {
  return (
    <div className="w-full max-w-2xl mx-auto bg-white rounded-2xl shadow-xl p-8">
      <div className="text-center mb-6">
        <div className="w-20 h-20 rounded-full overflow-hidden flex items-center justify-center mx-auto mb-4 bg-white">
          <img src="/logo.jpeg" alt="School Logo" className="w-full h-full object-contain" />
        </div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">NBSC Alumni Portal</h2>
        <p className="text-gray-600">Alumni Tracer - Welcome</p>
      </div>

      <div className="space-y-4 text-gray-700">
        <p>Dear Alumni,</p>
        <p>
          Greetings from your Alma Mater! We value our graduates you are a clear proof of our success. We aim to
          stay connected with you to build a stronger alumni network and open opportunities for collaboration.
        </p>
        <p>
          Please help us keep our records up to date by creating your alumni account. Your information will be treated
          with the utmost confidentiality and used only for alumni engagement and analytics.
        </p>
        <p>Thank you and God bless you always!</p>
        <p className="text-sm text-gray-500"></p>
      </div>

      <div className="mt-8 flex items-center justify-between">
        <button
          type="button"
          onClick={onCancel}
          className="inline-flex items-center px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50"
        >
          <ArrowLeft size={16} className="mr-2" /> Back
        </button>
        <button
          type="button"
          onClick={onNext}
          className="inline-flex items-center px-5 py-2.5 rounded-lg bg-green-600 text-white hover:bg-green-700"
        >
          Next <ArrowRight size={16} className="ml-2" />
        </button>
      </div>
    </div>
  );
};

export default PreRegisterGreeting;
