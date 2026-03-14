import { useState, useCallback } from 'react';
import { CustomerInfo } from '../models/payments/PaymentData';

export interface PaymentFormData {
    amount: string;
    currency: string;
    paymentMethod: string;
    customerName: string;
    customerEmail: string;
    customerDocument?: string;
    customerPhone?: string;
}

export interface ValidationErrors {
    amount?: string;
    currency?: string;
    paymentMethod?: string;
    customerName?: string;
    customerEmail?: string;
    customerDocument?: string;
    customerPhone?: string;
}

export interface UsePaymentValidationReturn {
    formData: PaymentFormData;
    errors: ValidationErrors;
    isValid: boolean;
    setFormData: (data: Partial<PaymentFormData>) => void;
    validateForm: () => boolean;
    clearErrors: () => void;
    getCustomerInfo: () => CustomerInfo;
}

export const usePaymentValidation = (initialData?: Partial<PaymentFormData>): UsePaymentValidationReturn => {
    const [formData, setFormDataState] = useState<PaymentFormData>({
        amount: '',
        currency: 'USD',
        paymentMethod: '',
        customerName: '',
        customerEmail: '',
        customerDocument: '',
        customerPhone: '',
        ...initialData
    });

    const [errors, setErrors] = useState<ValidationErrors>({});

    const setFormData = useCallback((data: Partial<PaymentFormData>) => {
        setFormDataState(prev => ({ ...prev, ...data }));
        // Clear errors for updated fields
        const updatedErrors = { ...errors };
        Object.keys(data).forEach(key => {
            if (updatedErrors[key as keyof ValidationErrors]) {
                delete updatedErrors[key as keyof ValidationErrors];
            }
        });
        setErrors(updatedErrors);
    }, [errors]);

    const validateAmount = (amount: string): string | undefined => {
        if (!amount.trim()) {
            return 'Amount is required';
        }
        const numAmount = parseFloat(amount);
        if (isNaN(numAmount) || numAmount <= 0) {
            return 'Amount must be a positive number';
        }
        if (numAmount < 0.01) {
            return 'Amount must be at least 0.01';
        }
        return undefined;
    };

    const validateCurrency = (currency: string): string | undefined => {
        if (!currency.trim()) {
            return 'Currency is required';
        }
        const validCurrencies = ['USD', 'EUR', 'BRL', 'ARS', 'MXN', 'COP', 'CLP', 'PEN'];
        if (!validCurrencies.includes(currency.toUpperCase())) {
            return 'Please select a valid currency';
        }
        return undefined;
    };

    const validatePaymentMethod = (paymentMethod: string): string | undefined => {
        if (!paymentMethod.trim()) {
            return 'Payment method is required';
        }
        return undefined;
    };

    const validateCustomerName = (name: string): string | undefined => {
        if (!name.trim()) {
            return 'Customer name is required';
        }
        if (name.trim().length < 2) {
            return 'Customer name must be at least 2 characters';
        }
        return undefined;
    };

    const validateEmail = (email: string): string | undefined => {
        if (!email.trim()) {
            return 'Email is required';
        }
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return 'Please enter a valid email address';
        }
        return undefined;
    };

    const validateDocument = (document: string): string | undefined => {
        // Document is optional, but if provided, should be reasonable length
        if (document && document.length > 20) {
            return 'Document number is too long';
        }
        return undefined;
    };

    const validatePhone = (phone: string): string | undefined => {
        // Phone is optional, but if provided, should be reasonable format
        if (phone && !/^\+?[\d\s\-\(\)]+$/.test(phone)) {
            return 'Please enter a valid phone number';
        }
        return undefined;
    };

    const validateForm = useCallback((): boolean => {
        const newErrors: ValidationErrors = {
            amount: validateAmount(formData.amount),
            currency: validateCurrency(formData.currency),
            paymentMethod: validatePaymentMethod(formData.paymentMethod),
            customerName: validateCustomerName(formData.customerName),
            customerEmail: validateEmail(formData.customerEmail),
            customerDocument: validateDocument(formData.customerDocument || ''),
            customerPhone: validatePhone(formData.customerPhone || '')
        };

        // Remove undefined errors
        Object.keys(newErrors).forEach(key => {
            if (!newErrors[key as keyof ValidationErrors]) {
                delete newErrors[key as keyof ValidationErrors];
            }
        });

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    }, [formData]);

    const clearErrors = useCallback(() => {
        setErrors({});
    }, []);

    const getCustomerInfo = useCallback((): CustomerInfo => {
        return {
            name: formData.customerName,
            email: formData.customerEmail,
            document: formData.customerDocument || undefined,
            phone: formData.customerPhone || undefined
        };
    }, [formData]);

    const isValid = Object.keys(errors).length === 0;

    return {
        formData,
        errors,
        isValid,
        setFormData,
        validateForm,
        clearErrors,
        getCustomerInfo
    };
};
