import React, { useState } from 'react';
import { ArrowLeft, X } from 'lucide-react';
import { PropertyFormStep1 } from './PropertyFormStep1';
import { PropertyFormStep2 } from './PropertyFormStep2';
import { PropertyFormStep3 } from './PropertyFormStep3';
interface AddPropertyFormProps {
  onClose: () => void;
}
export function AddPropertyForm({
  onClose
}: AddPropertyFormProps) {
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState({
    // Step 1
    address: '',
    address2: '',
    city: '',
    state: '',
    zipCode: '',
    country: '',
    location: {
      lat: 0,
      lng: 0
    },
    isPublished: false,
    // Step 2
    capacity: '',
    bedrooms: '',
    bathrooms: '',
    availableFrom: '',
    salePrice: '',
    rentPrice: '',
    currency: 'EUR',
    // Step 3
    images: [] as File[],
    mainImage: null as File | null
  });
  const updateFormData = (data: Partial<typeof formData>) => {
    setFormData(prev => ({
      ...prev,
      ...data
    }));
  };
  const handleNext = () => {
    setCurrentStep(prev => Math.min(prev + 1, 3));
  };
  const handleBack = () => {
    setCurrentStep(prev => Math.max(prev - 1, 1));
  };
  const handleSubmit = () => {
    console.log('Form submitted:', formData);
    onClose();
  };
  return <div className="bg-[#FDFFFC] min-h-full">
      <div className="border-b border-gray-200">
        <div className="px-6 py-4 flex items-center justify-between">
          <div className="flex items-center">
            {currentStep > 1 && <button onClick={handleBack} className="mr-4 p-2 hover:bg-gray-100 rounded-full">
                <ArrowLeft size={20} className="text-[#101828]" />
              </button>}
            <h1 className="text-xl font-semibold text-[#101828]">
              Nueva Propiedad - Paso {currentStep} de 3
            </h1>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full">
            <X size={20} className="text-[#101828]" />
          </button>
        </div>
        <div className="px-6 flex space-x-1">
          {[1, 2, 3].map(step => <div key={step} className={`flex-1 h-1 rounded-full ${step <= currentStep ? 'bg-[#62B6CB]' : 'bg-gray-200'}`} />)}
        </div>
      </div>
      <div className="p-6">
        {currentStep === 1 && <PropertyFormStep1 formData={formData} updateFormData={updateFormData} onNext={handleNext} />}
        {currentStep === 2 && <PropertyFormStep2 formData={formData} updateFormData={updateFormData} onNext={handleNext} />}
        {currentStep === 3 && <PropertyFormStep3 formData={formData} updateFormData={updateFormData} onSubmit={handleSubmit} />}
      </div>
    </div>;
}