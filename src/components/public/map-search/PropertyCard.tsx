import { PropertyData } from "../../../services/PropertyService";

interface PropertyCardProps {
    key: string;
    property: PropertyData;
}

function PropertyCard(props : PropertyCardProps) {
    return (
        <>
            <div className="bg-white dark:bg-gray-800 rounded-lg overflow-hidden shadow-sm border border-gray-100 dark:border-gray-700 hover:shadow-md transition-shadow">
                <div className="relative h-48">
                    <img src={props.property.description} alt={props.property.title} className="w-full h-full object-cover" />
                </div>
            </div>
        </>
    )
}

export default PropertyCard;