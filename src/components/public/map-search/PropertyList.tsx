import React from 'react';
import { PropertyData } from '../../../services/PropertyService';
import PropertyCard from './PropertyCard';

function PropertyList(properties : PropertyData[]) {
  return (
    <div style={{ overflowY: 'auto', height: '100vh', padding: '10px' }}>
      <h2>Properties</h2>
      {properties.map((property : PropertyData) => (
        <PropertyCard key={property.id} property={property} />
      ))}
    </div>
  );
};

export default PropertyList;