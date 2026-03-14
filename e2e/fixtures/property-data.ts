import { PropertyFormData } from '../../src/pages/dashboard/AddPropertyForm';

/**
 * Test data factory for property forms
 * Generates realistic test data for different property scenarios
 */

export interface TestPropertyData extends PropertyFormData {
  testScenario?: string;
  expectedLocationChange?: boolean;
}

// Base property data with all required fields
const basePropertyData: Omit<PropertyFormData, 'type' | 'status'> = {
  // Address fields
  streetName: 'Avenida 18 de Julio',
  houseNumber: '1234',
  neighborhood: 'Centro',
  city: 'Montevideo',
  state: 'Montevideo',
  zipCode: '11000',
  country: 'Uruguay',
  location: { lat: -34.9011, lng: -56.1645 }, // Default Montevideo, should be overridden by geocoding

  // Basic details
  title: 'Hermoso apartamento en el centro',
  areaValue: 80,
  areaUnit: 'm²',
  bedrooms: 2,
  bathrooms: 1,
  hasGarage: false,
  garageSpaces: 0,

  // Pricing and availability
  description: 'Excelente apartamento en ubicación céntrica, ideal para estudiantes o jóvenes profesionales.',
  availableFrom: new Date().toISOString().split('T')[0], // Today
  currency: 'USD',
  salePrice: '',
  rentPrice: '1200',
  hasCommonExpenses: true,
  commonExpensesValue: '150',
  isElectricityIncluded: false,
  isWaterIncluded: true,
  isPriceVisible: true,
  isActive: true,
  isPropertyVisible: true,

  // Amenities (empty for basic tests)
  amenities: [],
};

// Property type variations
export const propertyScenarios = {
  apartmentForSale: {
    ...basePropertyData,
    testScenario: 'Apartment for sale',
    expectedLocationChange: true,
    title: 'Moderno apartamento en venta',
    type: 'apartment' as const,
    status: 'sale' as const,
    salePrice: '150000',
    rentPrice: '',
    bedrooms: 3,
    bathrooms: 2,
    areaValue: 120,
  },

  houseForRent: {
    ...basePropertyData,
    testScenario: 'House for rent',
    expectedLocationChange: true,
    title: 'Casa familiar en alquiler',
    type: 'house' as const,
    status: 'rent' as const,
    salePrice: '',
    rentPrice: '2500',
    bedrooms: 4,
    bathrooms: 3,
    areaValue: 200,
    hasGarage: true,
    garageSpaces: 2,
  },

  commercialProperty: {
    ...basePropertyData,
    testScenario: 'Commercial property',
    expectedLocationChange: true,
    title: 'Local comercial en zona comercial',
    type: 'commercial' as const,
    status: 'rent' as const,
    salePrice: '',
    rentPrice: '3500',
    bedrooms: 0,
    bathrooms: 1,
    areaValue: 150,
  },

  landProperty: {
    ...basePropertyData,
    testScenario: 'Land property',
    expectedLocationChange: true,
    title: 'Terreno para construcción',
    type: 'land' as const,
    status: 'sale' as const,
    salePrice: '80000',
    rentPrice: '',
    bedrooms: 0,
    bathrooms: 0,
    areaValue: 500,
    areaUnit: 'm²',
  },

  // Test edge cases
  minimalValidProperty: {
    ...basePropertyData,
    testScenario: 'Minimal valid property',
    expectedLocationChange: true,
    title: 'Propiedad básica',
    type: 'apartment' as const,
    status: 'rent' as const,
    salePrice: '',
    rentPrice: '800',
    areaValue: 50,
    description: '',
    hasCommonExpenses: false,
    commonExpensesValue: '',
  },

  // Property with all amenities enabled
  fullyEquippedProperty: {
    ...basePropertyData,
    testScenario: 'Fully equipped property',
    expectedLocationChange: true,
    title: 'Apartamento completamente equipado',
    type: 'apartment' as const,
    status: 'rent' as const,
    salePrice: '',
    rentPrice: '1800',
    bedrooms: 3,
    bathrooms: 2,
    areaValue: 100,
    hasGarage: true,
    garageSpaces: 1,
    hasCommonExpenses: true,
    commonExpensesValue: '200',
    isElectricityIncluded: true,
    isWaterIncluded: true,
    isPriceVisible: true,
  },
};

/**
 * Get test property data by scenario name
 */
export function getTestPropertyData(scenario: keyof typeof propertyScenarios = 'apartmentForSale'): TestPropertyData {
  return propertyScenarios[scenario];
}

/**
 * Generate a unique property title to avoid conflicts
 */
export function generateUniqueTitle(baseTitle: string): string {
  const timestamp = Date.now();
  const randomSuffix = Math.floor(Math.random() * 1000);
  return `${baseTitle} - Test ${timestamp}-${randomSuffix}`;
}

/**
 * Get all available test scenarios
 */
export function getAllTestScenarios(): TestPropertyData[] {
  return Object.values(propertyScenarios);
}








