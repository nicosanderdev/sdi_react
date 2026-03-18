import {
    PropertyParams,
    PublicPropertyDataList,
    PropertyDataList,
    PropertyData,
    PublicProperty,
    Amenity,
} from '../models/properties';
import { DuplicatedEstateProperty } from '../models/properties/DuplicatedEstateProperty';

import { supabase } from '../config/supabase';
import { getCurrentUserId, mapDbToPropertyData, mapDbToPublicProperty } from './SupabaseHelpers';

// Import types for Supabase property creation
import { PropertyFormData } from '../models/properties/PropertyFormSchema';
import { DisplayImage } from '../components/dashboard/properties/ImageManager';
import { DisplayDocument } from '../components/dashboard/properties/DocumentManager';


// Enum mappings for Supabase PostgreSQL function
const propertyStatusMap: { [key: string]: number } = {
    sale: 0, rent: 1, reserved: 2, sold: 3, unavailable: 4,
};

const areaUnitMap: { [key: string]: number } = {
    'm²': 0, 'ft²': 1, 'yd²': 2, 'acres': 3, 'hectares': 4, 'sq_km': 5, 'sq_mi': 6,
};

const currencyMap: { [key: string]: number } = {
    USD: 0, UYU: 1, BRL: 2, EUR: 3, GBP: 4,
};

const propertyTypeMap: { [key: string]: number } = {
    house: 0,
    apartment: 1,
    lot: 2, // Terreno
    small_farm: 3, // Chacra
    farmland: 4, // Campo
};


/**
 * Fetches a list of public properties.
 * @param params - The parameters for the query.
 * @returns A list of public properties.
 */
const getProperties = async (params?: PropertyParams): Promise<PublicPropertyDataList> => {
    try {
        let query = supabase
            .from('EstateProperties')
            .select(`
        *,
        RealEstateExtension(*),
        Listings!inner(*),
        PropertyImages(*),
        PropertyVideos(*),
        EstatePropertyAmenity(Amenities(*))
      `, { count: 'exact' })
            .eq('IsDeleted', false)
            .eq('Listings.IsDeleted', false)
            .eq('Listings.IsPropertyVisible', true)
            .eq('Listings.IsActive', true);

        // Apply filters
        if (params?.filter?.ownerId) {
            query = query.eq('OwnerId', params.filter.ownerId);
        }

        if (params?.filter?.status) {
            const statusCode = params.filter.status === 'sale' ? 0 : params.filter.status === 'rent' ? 1 : 0;
            query = query.eq('Listings.Status', statusCode);
        }

        if (params?.filter?.searchTerm) {
            query = query.or(`Title.ilike.%${params.filter.searchTerm}%,City.ilike.%${params.filter.searchTerm}%`);
        }

        // Apply date filters
        if (params?.filter?.createdAfter) {
            query = query.gte('Created', params.filter.createdAfter.toISOString());
        }

        if (params?.filter?.createdBefore) {
            query = query.lte('Created', params.filter.createdBefore.toISOString());
        }

        // Apply pagination
        if (params?.pageSize) {
            const from = ((params.pageNumber || 1) - 1) * params.pageSize;
            const to = from + params.pageSize - 1;
            query = query.range(from, to);
        }

        // Order by creation date (newest first)
        query = query.order('Created', { ascending: false });

        const { data, error, count } = await query;

        if (error) throw error;

        const items = data?.map(property => mapDbToPublicProperty(property)) || [];

        return {
            items,
            total: count || 0,
            page: params?.pageNumber || 1
        };
    } catch (error: any) {
        console.error('Error fetching properties:', error.message);
        throw error;
    }
};

/**
 * Fetches properties within a specific map bounding box.
 * This is optimized for map viewport-based queries.
 */
const getPropertiesInBounds = async (
    swLat: number,
    swLng: number,
    neLat: number,
    neLng: number,
    additionalParams?: Partial<PropertyParams>
): Promise<PublicPropertyDataList> => {
    try {
        let query = supabase
            .from('EstateProperties')
            .select(`
        *,
        RealEstateExtension(*),
        Listings!inner(*),
        PropertyImages(*),
        PropertyVideos(*),
        EstatePropertyAmenity(Amenities(*))
      `, { count: 'exact' })
            .eq('IsDeleted', false)
            .eq('Listings.IsDeleted', false)
            .eq('Listings.IsPropertyVisible', true)
            .eq('Listings.IsActive', true)
            .gte('LocationLatitude', swLat)
            .lte('LocationLatitude', neLat)
            .gte('LocationLongitude', swLng)
            .lte('LocationLongitude', neLng);

        // Apply additional filters
        if (additionalParams?.filter?.ownerId) {
            query = query.eq('OwnerId', additionalParams.filter.ownerId);
        }

        if (additionalParams?.filter?.status) {
            const statusCode = additionalParams.filter.status === 'sale' ? 0 : additionalParams.filter.status === 'rent' ? 1 : 0;
            query = query.eq('Listings.Status', statusCode);
        }

        if (additionalParams?.filter?.searchTerm) {
            query = query.or(`Title.ilike.%${additionalParams.filter.searchTerm}%,City.ilike.%${additionalParams.filter.searchTerm}%`);
        }

        // Apply pagination (default to 100 for map view)
        const pageSize = additionalParams?.pageSize ?? 100;
        const pageNumber = additionalParams?.pageNumber ?? 1;
        const from = (pageNumber - 1) * pageSize;
        const to = from + pageSize - 1;
        query = query.range(from, to);

        // Order by creation date (newest first)
        query = query.order('Created', { ascending: false });

        const { data, error, count } = await query;

        if (error) throw error;

        const items = data?.map(property => mapDbToPublicProperty(property)) || [];

        return {
            items,
            total: count || 0,
            page: pageNumber
        };
    } catch (error: any) {
        console.error('Error fetching properties in bounds:', error.message);
        throw error;
    }
};

// Fetch a list of properties owned by the user
const getUserProperties = async (params?: any): Promise<PropertyDataList> => {
    try {
        // Use the same logic as getOwnersProperties but with any params support
        return await getOwnersProperties(params);
    } catch (error: any) {
        console.error('Error fetching properties:', error.message);
        throw error;
    }
};
// Fetch a single property with public info by its ID
const getPropertyById = async (id: string, params?: PropertyParams): Promise<PublicProperty> => {
    try {
        let selectFields = '*, Listings!inner(*)';

        // Include related data based on params
        const includes = [];
        if (params?.filter?.includeImages) {
            includes.push('PropertyImages(*)');
        }
        if (params?.filter?.includeVideos) {
            includes.push('PropertyVideos(*)');
        }
        if (params?.filter?.includeAmenities) {
            includes.push('EstatePropertyAmenity(Amenities(*))');
        }

        if (includes.length > 0) {
            selectFields += `, ${includes.join(', ')}`;
        }

        const { data, error } = await supabase
            .from('EstateProperties')
            .select(selectFields)
            .eq('Id', id)
            .eq('IsDeleted', false)
            .eq('Listings.IsDeleted', false)
            .eq('Listings.IsPropertyVisible', true)
            .eq('Listings.IsActive', true)
            .single();

        if (error) {
            if (error.code === 'PGRST116') {
                throw new Error('Property not found');
            }
            throw error;
        }

        if (!data) {
            throw new Error('Property not found');
        }

        return mapDbToPublicProperty(data as any);
    } catch (error: any) {
        console.error(`Error fetching property ${id}:`, error.message);
        throw error;
    }
};

// Fetch a single property owned by the user by its ID
const getOwnersPropertyById = async (id: string): Promise<PropertyData> => {
    try {
        const userId = await getCurrentUserId();

        // First get the member ID for this user
        const { data: member, error: memberError } = await supabase
            .from('Members')
            .select('Id')
            .eq('UserId', userId)
            .eq('IsDeleted', false)
            .single();

        if (memberError) throw memberError;

        // Get all company IDs for this member
        const { data: userCompanies, error: companiesError } = await supabase
            .from('UserCompanies')
            .select('CompanyId')
            .eq('MemberId', member.Id)
            .eq('IsDeleted', false);

        if (companiesError) throw companiesError;

        const companyIds = userCompanies?.map(uc => uc.CompanyId) || [];

        // Build unified query that checks both member and company ownership
        let query = supabase
            .from('EstateProperties')
            .select(`
        *,
        RealEstateExtension(*),
        Owners!inner(OwnerType, MemberId, CompanyId),
        Listings(*),
        PropertyImages(*),
        PropertyDocuments(*),
        PropertyVideos(*),
        EstatePropertyAmenity(Amenities(*))
      `)
            .eq('Id', id)
            .eq('IsDeleted', false)
            .eq('Owners.IsDeleted', false);

        // Check both member ownership and company ownership in a single query
        if (companyIds.length > 0) {
            query = query.or(`Owners.OwnerType.eq.member,Owners.OwnerType.eq.company`)
                .eq('Owners.MemberId', member.Id)
                .in('Owners.CompanyId', companyIds);
        } else {
            // Only check member ownership if no companies
            query = query.eq('Owners.OwnerType', 'member')
                .eq('Owners.MemberId', member.Id);
        }

        const { data, error } = await query.single();

        if (error) {
            if (error.code === 'PGRST116') {
                // Property not found or access denied - let's get more details
                console.warn(`Property ${id} not accessible for user ${userId}. Member ID: ${member.Id}, Company IDs: [${companyIds.join(', ')}]`);

                // Check if property exists at all
                const { data: existsData, error: existsError } = await supabase
                    .from('EstateProperties')
                    .select('Id, OwnerId')
                    .eq('Id', id)
                    .eq('IsDeleted', false)
                    .single();

                if (existsError && existsError.code === 'PGRST116') {
                    console.error(`Property ${id} does not exist in database`);
                    throw new Error('Property not found');
                } else if (existsData) {
                    // Property exists, check owner details
                    const { data: ownerData } = await supabase
                        .from('Owners')
                        .select('Id, OwnerType, MemberId, CompanyId')
                        .eq('Id', existsData.OwnerId)
                        .single();

                    if (ownerData) {
                        console.error(`Property ${id} exists but access denied. Property owner details:`, {
                            ownerType: ownerData.OwnerType,
                            ownerMemberId: ownerData.MemberId,
                            ownerCompanyId: ownerData.CompanyId,
                            userMemberId: member.Id,
                            userCompanyIds: companyIds
                        });

                        const accessReason = ownerData.OwnerType === 'member'
                            ? `Property owned by member ${ownerData.MemberId}, user is member ${member.Id}`
                            : `Property owned by company ${ownerData.CompanyId}, user has access to companies: [${companyIds.join(', ')}]`;

                        throw new Error(`Access denied to property ${id}: ${accessReason}`);
                    } else {
                        console.error(`Property ${id} exists but owner record not found. OwnerId: ${existsData.OwnerId}`);
                        throw new Error('Property owner information missing');
                    }
                } else {
                    throw new Error('Property not found or access denied');
                }
            }
            throw error;
        }

        return mapDbToPropertyData(data);
    } catch (error: any) {
        console.error(`Error fetching property ${id}:`, error.message);
        throw error;
    }
};

// Fetch a list of properties owned by the user
const getOwnersProperties = async (params?: PropertyParams & { companyId?: string; user?: any }): Promise<PropertyDataList> => {
    try {
        const userId = await getCurrentUserId(params?.user);

        // Get the member ID for this user
        const { data: member, error: memberError } = await supabase
            .from('Members')
            .select('Id')
            .eq('UserId', userId)
            .eq('IsDeleted', false)
            .maybeSingle();

        if (memberError) throw memberError;
        if (!member) {
            throw new Error('No member record found for current user');
        }

        let query = supabase
            .from('EstateProperties')
            .select(`
        *,
        RealEstateExtension(*),
        Owners!inner(OwnerType, MemberId, CompanyId),
        Listings(*),
        PropertyImages(*),
        PropertyDocuments(*),
        PropertyVideos(*),
        EstatePropertyAmenity(Amenities(*))
      `, { count: 'exact' })
            .eq('IsDeleted', false)
            .eq('Owners.IsDeleted', false);

        // Filter by ownership through the Owners table join
        // We need to check both direct member ownership and company ownership
        if (params?.companyId === 'all-companies') {
            // For all companies, get all company IDs for this member
            const { data: userCompanies, error: companiesError } = await supabase
                .from('UserCompanies')
                .select('CompanyId')
                .eq('MemberId', member.Id)
                .eq('IsDeleted', false);

            if (companiesError) throw companiesError;

            const companyIds = userCompanies?.map(uc => uc.CompanyId) || [];

            if (companyIds.length > 0) {
                query = query.or(`Owners.OwnerType.eq.member,Owners.OwnerType.eq.company`)
                    .eq('Owners.MemberId', member.Id)
                    .in('Owners.CompanyId', companyIds);
            } else {
                query = query.eq('Owners.OwnerType', 'member')
                    .eq('Owners.MemberId', member.Id);
            }
        } else if (params?.companyId) {
            // Specific company ID
            query = query.or(`Owners.OwnerType.eq.member,Owners.OwnerType.eq.company`)
                .eq('Owners.MemberId', member.Id)
                .eq('Owners.CompanyId', params.companyId);
        } else {
            // Personal properties only
            query = query.eq('Owners.OwnerType', 'member')
                .eq('Owners.MemberId', member.Id);
        }

        // Apply filters
        if (params?.filter?.status) {
            const statusCode = params.filter.status === 'sale' ? 0 : params.filter.status === 'rent' ? 1 :
                params.filter.status === 'reserved' ? 2 : params.filter.status === 'sold' ? 3 :
                    params.filter.status === 'unavailable' ? 4 : 0;
            query = query.eq('Listings.Status', statusCode);
        }

        if (params?.filter?.searchTerm) {
            query = query.or(`Title.ilike.%${params.filter.searchTerm}%,City.ilike.%${params.filter.searchTerm}%`);
        }

        // Apply date filters
        if (params?.filter?.createdAfter) {
            query = query.gte('Created', params.filter.createdAfter.toISOString());
        }

        if (params?.filter?.createdBefore) {
            query = query.lte('Created', params.filter.createdBefore.toISOString());
        }

        // Apply pagination
        if (params?.pageSize) {
            const from = ((params.pageNumber || 1) - 1) * params.pageSize;
            const to = from + params.pageSize - 1;
            query = query.range(from, to);
        }

        // Order by creation date (newest first)
        query = query.order('Created', { ascending: false });

        const { data, error, count } = await query;

        if (error) throw error;

        const items = data?.map(property => mapDbToPropertyData(property)) || [];

        return {
            items,
            total: count || 0,
            page: params?.pageNumber || 1
        };
    } catch (error: any) {
        console.error('Error fetching properties:', error.message);
        throw error;
    }
};


// Internal: create property with a specific owner user id (used by createProperty and createPropertyForOwner)
const createPropertyWithOwnerUserId = async (
    ownerUserId: string,
    formData: PropertyFormData,
    displayImages: DisplayImage[],
    displayDocuments: DisplayDocument[]
): Promise<PropertyData> => {
    try {
        const areaUnitMapReverse: { [key: number]: PropertyData['areaUnit'] } = {
            0: 'm²',
            1: 'ft²',
            2: 'yd²',
            3: 'acres',
            4: 'hectares',
            5: 'sq_km',
            6: 'sq_mi',
        };

        const locationCategoryMapReverse: { [key: number]: NonNullable<PropertyData['locationCategory']> } = {
            0: 'rural',
            1: 'city',
            2: 'near_shore',
        };

        const viewTypeMapReverse: { [key: number]: NonNullable<PropertyData['viewType']> } = {
            0: 'city',
            1: 'mountain',
            2: 'rural',
            3: 'sea',
        };

        const locationCategoryMapForward: { [key: string]: number } = {
            rural: 0,
            city: 1,
            near_shore: 2,
        };

        const viewTypeMapForward: { [key: string]: number } = {
            city: 0,
            mountain: 1,
            rural: 2,
            sea: 3,
        };

        // Resolve logical member (owner) from the auth user id
        const { data: memberRow, error: memberError } = await supabase
            .from('Members')
            .select('Id')
            .eq('UserId', ownerUserId)
            .eq('IsDeleted', false)
            .single();

        if (memberError) {
            throw memberError;
        }

        if (!memberRow?.Id) {
            throw new Error('No member found for the specified owner user.');
        }

        const memberId = memberRow.Id as string;

        // Upload images to Supabase Storage
        const uploadedImages = await Promise.all(
            displayImages
                .filter(img => img.source === 'new' && img.file)
                .map(async (img) => {
                    const fileExt = img.file!.name.split('.').pop();
                    const fileName = `properties/temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}.${fileExt}`;

                    const { error: uploadError } = await supabase.storage
                        .from('property_images')
                        .upload(fileName, img.file!, {
                            cacheControl: '3600',
                            upsert: true
                        });

                    if (uploadError) {
                        throw uploadError;
                    }

                    const { data: urlData } = supabase.storage
                        .from('property_images')
                        .getPublicUrl(fileName);

                    return {
                        id: img.id || crypto.randomUUID(),
                        url: urlData.publicUrl,
                        altText: img.alt || '',
                        isMain: img.isMain,
                        fileName: img.alt || ''
                    };
                })
        );

        // Include existing images
        const existingImages = displayImages
            .filter(img => img.source === 'existing')
            .map(img => ({
                id: img.id || crypto.randomUUID(),
                url: img.previewUrl,
                altText: img.alt || '',
                isMain: img.isMain,
                fileName: img.alt || ''
            }));

        const allImages = [...uploadedImages, ...existingImages];

        // Upload documents to Supabase Storage
        const uploadedDocuments = await Promise.all(
            displayDocuments
                .filter(doc => doc.source === 'new' && doc.file)
                .map(async (doc) => {
                    const fileExt = doc.file!.name.split('.').pop();
                    const fileName = `properties/temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}.${fileExt}`;

                    const { error: uploadError } = await supabase.storage
                        .from('property_documents')
                        .upload(fileName, doc.file!, {
                            cacheControl: '3600',
                            upsert: true
                        });

                    if (uploadError) {
                        throw uploadError;
                    }

                    const { data: urlData } = supabase.storage
                        .from('property_documents')
                        .getPublicUrl(fileName);

                    return {
                        id: doc.id || crypto.randomUUID(),
                        url: urlData.publicUrl,
                        name: doc.name || '',
                        fileName: doc.fileName || doc.name || '',
                        fileType: doc.fileType || 'pdf'
                    };
                })
        );

        // Include existing documents
        const existingDocuments = displayDocuments
            .filter(doc => doc.source === 'existing')
            .map(doc => ({
                id: doc.id || crypto.randomUUID(),
                url: doc.url || '',
                name: doc.name || '',
                fileName: doc.fileName || doc.name || '',
                fileType: doc.fileType || 'pdf'
            }));

        const allDocuments = [...uploadedDocuments, ...existingDocuments];

        // Prepare videos array (videos are just URLs, no file upload needed)
        const videos = displayImages
            .filter(img => img.source === 'existing' && img.id?.startsWith('video-'))
            .map(video => ({
                id: video.id!.replace('video-', ''),
                url: video.previewUrl,
                title: video.alt || '',
                description: '',
            }));

        const physicalType = ((formData as any).type ?? 'house') as string;
        const propertyCategoryCode = propertyTypeMap[physicalType] ?? propertyTypeMap.house;

        const areaUnitCode = areaUnitMap[((formData as any).areaUnit ?? 'm²') as string] ?? areaUnitMap['m²'];

        // The creation wizard currently does not capture location/view categories.
        // Use sensible defaults aligned with the enum order in `public_schema_base.sql`.
        const locationCategoryKey = ((formData as any).locationCategory ?? 'city') as string;
        const viewTypeKey = ((formData as any).viewType ?? 'city') as string;
        const locationCategory = locationCategoryMapForward[locationCategoryKey] ?? locationCategoryMapForward.city;
        const viewType = viewTypeMapForward[viewTypeKey] ?? viewTypeMapForward.city;

        const extensionType = formData.propertyType ?? 'RealEstate';

        const { data: createdEstate, error: createEstateError } = await supabase.rpc('create_estate_property', {
            p_member_id: memberId,
            // address
            p_street_name: formData.streetName,
            p_house_number: formData.houseNumber,
            p_neighborhood: formData.neighborhood || null,
            p_city: formData.city,
            p_state: formData.state,
            p_zip_code: formData.zipCode,
            p_country: formData.country,
            p_location_lat: formData.location.lat,
            p_location_lng: formData.location.lng,

            // structural
            p_property_category: propertyCategoryCode,
            p_area_value: formData.areaValue,
            p_area_unit: areaUnitCode,
            p_bedrooms: formData.bedrooms,
            p_bathrooms: formData.bathrooms,
            p_garage_spaces: formData.garageSpaces,

            // infrastructure
            p_has_laundry_room: formData.hasLaundryRoom ?? false,
            p_has_pool: formData.hasPool ?? false,
            p_has_balcony: formData.hasBalcony ?? false,
            p_is_furnished: formData.isFurnished ?? false,
            p_capacity: formData.capacity ?? null,

            // location and view categories
            p_location_category: locationCategory,
            p_view_type: viewType,

            // Real Estate Extension
            p_allows_financing: formData.allowsFinancing ?? false,
            p_is_new_construction: formData.isNewConstruction ?? false,
            p_has_mortgage: formData.hasMortgage ?? false,
            p_hoa_fees: formData.hoaFees ?? null,
            p_min_contract_months: formData.minContractMonths ?? null,
            p_requires_guarantee: formData.requiresGuarantee ?? false,
            p_guarantee_type: formData.guaranteeType || null,
            p_allows_pets: formData.allowsPets ?? false,

            // Event Venue Extension
            p_max_guests: formData.maxGuests ?? null,
            p_has_catering: formData.hasCatering ?? false,
            p_has_sound_system: formData.hasSoundSystem ?? false,
            p_closing_hour: formData.closingHour || null,
            p_allowed_events_description: formData.allowedEventsDescription || null,

            // Summer Rent Extension
            p_min_stay_days: formData.minStayDays ?? null,
            p_max_stay_days: formData.maxStayDays ?? null,
            p_lead_time_days: formData.leadTimeDays ?? null,
            p_buffer_days: formData.bufferDays ?? null,

            // extension type
            p_extension_type: extensionType,

            // amenities
            p_amenity_ids: formData.amenities && formData.amenities.length > 0 ? formData.amenities : null,
        });

        if (createEstateError) throw createEstateError;

        const estateResult = createdEstate as any;
        const estatePropertyId = estateResult.id as string;

        // 1) Insert listing row
        const availableFromDate = formData.availableFrom ? new Date(formData.availableFrom) : new Date();
        const listingType =
            (formData.listingType ??
                (extensionType === 'RealEstate' ? 'RealEstate' : extensionType)) as
                | 'SummerRent'
                | 'EventVenue'
                | 'AnnualRent'
                | 'RealEstate';

        const statusKey = ((formData.status ?? 'sale') as string) as keyof typeof propertyStatusMap;
        const currencyKey = ((formData.currency ?? 'USD') as string) as keyof typeof currencyMap;

        const salePriceValue = formData.salePrice ? parseFloat(formData.salePrice) : null;
        const rentPriceValue = formData.rentPrice ? parseFloat(formData.rentPrice) : null;
        const commonExpensesValue = formData.commonExpensesValue ? parseFloat(formData.commonExpensesValue) : null;

        const { error: listingError } = await supabase.rpc('insert_listing', {
            p_estate_property_id: estatePropertyId,
            p_listing_type: listingType,
            p_title: formData.title,
            p_description: formData.description || null,
            p_available_from: availableFromDate.toISOString(),
            p_capacity: formData.capacity ?? null,
            p_currency: currencyMap[currencyKey] ?? currencyMap.USD,
            p_sale_price: salePriceValue,
            p_rent_price: rentPriceValue,
            p_has_common_expenses: formData.hasCommonExpenses ?? false,
            p_common_expenses_value: commonExpensesValue,
            p_is_electricity_included: formData.isElectricityIncluded ?? false,
            p_is_water_included: formData.isWaterIncluded ?? false,
            p_is_price_visible: formData.isPriceVisible ?? true,
            p_status: propertyStatusMap[statusKey] ?? propertyStatusMap.sale,
            p_is_active: formData.isActive ?? true,
            p_is_property_visible: formData.isPropertyVisible ?? true,
            p_is_featured: true,
            p_blocked_for_booking: false,
        });

        if (listingError) throw listingError;

        // 2) Insert property media rows
        const insertedImageIds: string[] = [];
        for (const img of allImages) {
            const { data: imageId, error: imgError } = await supabase.rpc('insert_property_image', {
                p_estate_property_id: estatePropertyId,
                p_url: img.url,
                p_alt_text: img.altText || null,
                p_is_main: img.isMain,
            });
            if (imgError) throw imgError;
            insertedImageIds.push(imageId as string);
        }

        const docsToInsert = allDocuments.filter(d => !!d.url);
        const insertedDocumentIds: string[] = [];
        for (const doc of docsToInsert) {
            const { data: documentId, error: docError } = await supabase.rpc('insert_property_document', {
                p_estate_property_id: estatePropertyId,
                p_name: doc.name || '',
                p_file_type: doc.fileType || 'pdf',
                p_url: doc.url,
                p_is_public: true,
            });
            if (docError) throw docError;
            insertedDocumentIds.push(documentId as string);
        }

        const videosToInsert = videos.filter(v => !!v.url);
        const insertedVideoIds: string[] = [];
        for (const video of videosToInsert) {
            const { data: videoId, error: videoError } = await supabase.rpc('insert_property_video', {
                p_estate_property_id: estatePropertyId,
                p_url: video.url,
                p_title: video.title || null,
                p_description: video.description || null,
            });
            if (videoError) throw videoError;
            insertedVideoIds.push(videoId as string);
        }

        // Build response object for UI
        const propertyImages: PropertyData['propertyImages'] = allImages.map((img, idx) => ({
            id: insertedImageIds[idx],
            url: img.url,
            altText: img.altText,
            isMain: img.isMain,
            estatePropertyId,
            isPublic: true,
            fileName: img.fileName,
        }));

        const propertyDocuments: PropertyData['propertyDocuments'] = docsToInsert.map((doc, idx) => ({
            id: insertedDocumentIds[idx],
            url: doc.url,
            name: doc.name,
            estatePropertyId,
            fileName: doc.fileName,
            isPublic: true,
        }));

        const propertyVideos: PropertyData['propertyVideos'] = videosToInsert.map((video, idx) => ({
            id: insertedVideoIds[idx],
            url: video.url,
            title: video.title,
            description: video.description,
            estatePropertyId,
            isPublic: true,
        }));

        const areaUnitUi = areaUnitMapReverse[estateResult.areaUnit] ?? 'm²';
        const locationCategoryUi = locationCategoryMapReverse[estateResult.locationCategory];
        const viewTypeUi = viewTypeMapReverse[estateResult.viewType];

        const createdDate = estateResult.created ? new Date(estateResult.created) : new Date();

        const salePriceString = salePriceValue != null ? salePriceValue.toString() : undefined;
        const rentPriceString = rentPriceValue != null ? rentPriceValue.toString() : undefined;
        const commonExpensesString = commonExpensesValue != null ? commonExpensesValue.toString() : undefined;

        return {
            id: estatePropertyId,

            // address
            streetName: estateResult.streetName,
            houseNumber: estateResult.houseNumber,
            neighborhood: estateResult.neighborhood || undefined,
            city: estateResult.city,
            state: estateResult.state,
            zipCode: estateResult.zipCode,
            country: estateResult.country,

            // map
            location: estateResult.location,

            // description + listing values
            title: formData.title,
            description: formData.description || undefined,
            availableFrom: availableFromDate,
            availableFromText: availableFromDate.toLocaleDateString(),
            currency: (formData.currency ?? 'USD') as any,
            salePrice: salePriceString,
            rentPrice: rentPriceString,
            hasCommonExpenses: formData.hasCommonExpenses ?? false,
            commonExpensesValue: commonExpensesString,
            isElectricityIncluded: formData.isElectricityIncluded ?? false,
            isWaterIncluded: formData.isWaterIncluded ?? false,
            isPriceVisible: formData.isPriceVisible ?? true,
            status: (formData.status ?? 'sale') as any,
            isActive: formData.isActive ?? true,
            isPropertyVisible: formData.isPropertyVisible ?? true,

            // structural
            areaValue: estateResult.areaValue,
            areaUnit: areaUnitUi,
            bedrooms: estateResult.bedrooms,
            bathrooms: estateResult.bathrooms,
            hasGarage: estateResult.hasGarage,
            garageSpaces: estateResult.garageSpaces,

            // end-purpose type and structural/infrastructure flags
            propertyType: extensionType as any,
            hasLaundryRoom: estateResult.hasLaundryRoom,
            hasPool: estateResult.hasPool,
            hasBalcony: estateResult.hasBalcony,
            isFurnished: estateResult.isFurnished,
            capacity: estateResult.capacity ?? undefined,

            // relationships
            ownerId: estateResult.ownerId,
            propertyImages,
            propertyDocuments,
            propertyVideos,

            // location + view categories (optional)
            locationCategory: locationCategoryUi,
            viewType: viewTypeUi,

            amenities: [],

            created: createdDate,
        };

    } catch (error: any) {
        console.error('Error creating property with Supabase:', error.message);

        // Handle quota limit errors specifically
        if (error.message && error.message.includes('Property limit exceeded')) {
            throw new Error(error.message);
        }

        throw new Error(error.message || 'Failed to create property with Supabase');
    }
};

// Create a new property using Supabase (with file uploads to Storage) — uses current user as owner
const createProperty = async (
    formData: PropertyFormData,
    displayImages: DisplayImage[],
    displayDocuments: DisplayDocument[]
): Promise<PropertyData> => {
    const userId = await getCurrentUserId();
    return createPropertyWithOwnerUserId(userId, formData, displayImages, displayDocuments);
};

// Admin: create a property on behalf of another user (ownerUserId = that user's auth id)
const createPropertyForOwner = async (
    ownerUserId: string,
    formData: PropertyFormData,
    displayImages: DisplayImage[],
    displayDocuments: DisplayDocument[]
): Promise<PropertyData> => {
    return createPropertyWithOwnerUserId(ownerUserId, formData, displayImages, displayDocuments);
};

// Update an existing property
const updateProperty = async (
    id: string,
    formData: PropertyFormData,
    displayImages: DisplayImage[],
    displayDocuments: DisplayDocument[]
): Promise<PropertyData> => {
    try {
        const userId = await getCurrentUserId();

        // Upload new images to Supabase Storage
        const uploadedImages = await Promise.all(
            displayImages
                .filter(img => img.source === 'new' && img.file)
                .map(async (img) => {
                    const fileExt = img.file!.name.split('.').pop();
                    const fileName = `properties/temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}.${fileExt}`;

                    const { error: uploadError } = await supabase.storage
                        .from('property_images')
                        .upload(fileName, img.file!, {
                            cacheControl: '3600',
                            upsert: true
                        });

                    if (uploadError) throw uploadError;

                    const { data: urlData } = supabase.storage
                        .from('property_images')
                        .getPublicUrl(fileName);

                    return {
                        id: img.id || crypto.randomUUID(),
                        url: urlData.publicUrl,
                        altText: img.alt || '',
                        isMain: img.isMain,
                        fileName: img.alt || '',
                        isPublic: true
                    };
                })
        );

        // Include existing images
        const existingImages = displayImages
            .filter(img => img.source === 'existing')
            .map(img => ({
                id: img.id || crypto.randomUUID(),
                url: img.previewUrl,
                altText: img.alt || '',
                isMain: img.isMain,
                fileName: img.alt || '',
                isPublic: true
            }));

        const allImages = [...uploadedImages, ...existingImages];

        // Upload new documents to Supabase Storage
        const uploadedDocuments = await Promise.all(
            displayDocuments
                .filter(doc => doc.source === 'new' && doc.file)
                .map(async (doc) => {
                    const fileExt = doc.file!.name.split('.').pop();
                    const fileName = `properties/temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}.${fileExt}`;

                    const { error: uploadError } = await supabase.storage
                        .from('property_documents')
                        .upload(fileName, doc.file!, {
                            cacheControl: '3600',
                            upsert: true
                        });

                    if (uploadError) throw uploadError;

                    const { data: urlData } = supabase.storage
                        .from('property_documents')
                        .getPublicUrl(fileName);

                    return {
                        id: doc.id || crypto.randomUUID(),
                        url: urlData.publicUrl,
                        name: doc.name || '',
                        fileName: doc.fileName || doc.name || '',
                        isPublic: true
                    };
                })
        );

        // Include existing documents
        const existingDocuments = displayDocuments
            .filter(doc => doc.source === 'existing')
            .map(doc => ({
                id: doc.id || crypto.randomUUID(),
                url: doc.url || '',
                name: doc.name || '',
                fileName: doc.fileName || doc.name || '',
                isPublic: true
            }));

        const allDocuments = [...uploadedDocuments, ...existingDocuments];

        // Prepare videos array (videos are just URLs, no file upload needed)
        const videos = displayImages
            .filter(img => img.source === 'existing' && img.id?.startsWith('video-'))
            .map(video => ({
                id: video.id!.replace('video-', ''),
                url: video.previewUrl,
                title: video.alt || '',
                description: '',
                isPublic: true
            }));

        // Call update RPC function
        const { data, error } = await supabase.rpc('update_estate_property', {
            p_property_id: id,
            p_street_name: formData.streetName,
            p_house_number: formData.houseNumber,
            p_neighborhood: formData.neighborhood || null,
            p_city: formData.city,
            p_state: formData.state,
            p_zip_code: formData.zipCode,
            p_country: formData.country,
            p_location_lat: formData.location.lat,
            p_location_lng: formData.location.lng,
            p_title: formData.title,
            p_property_type: propertyTypeMap[((formData as any).type ?? 'house') as string],
            p_area_value: formData.areaValue,
            p_area_unit: areaUnitMap[((formData as any).areaUnit ?? 'm²') as string],
            p_bedrooms: formData.bedrooms,
            p_bathrooms: formData.bathrooms,
            p_has_garage: formData.hasGarage,
            p_garage_spaces: formData.garageSpaces,
            p_description: formData.description || null,
            p_available_from: new Date(((formData as any).availableFrom || new Date()) as any).toISOString(),
            p_currency: currencyMap[((formData as any).currency ?? 'USD') as string],
            p_sale_price: formData.salePrice ? parseFloat(formData.salePrice) : null,
            p_rent_price: formData.rentPrice ? parseFloat(formData.rentPrice) : null,
            p_has_common_expenses: formData.hasCommonExpenses,
            p_common_expenses_value: formData.commonExpensesValue ? parseFloat(formData.commonExpensesValue) : null,
            p_is_electricity_included: formData.isElectricityIncluded,
            p_is_water_included: formData.isWaterIncluded,
            p_is_price_visible: formData.isPriceVisible,
            p_status: propertyStatusMap[((formData as any).status ?? 'sale') as string],
            p_is_active: formData.isActive,
            p_is_property_visible: formData.isPropertyVisible,
            p_property_images: allImages,
            p_property_documents: allDocuments,
            p_property_videos: videos,
            p_amenity_ids: formData.amenities || [],
            p_user_id: userId
        });

        if (error) throw error;

        // Convert the returned JSONB to PropertyData format
        const result = data as any;
        return {
            id: result.id,
            streetName: result.streetName,
            houseNumber: result.houseNumber,
            neighborhood: result.neighborhood,
            city: result.city,
            state: result.state,
            zipCode: result.zipCode,
            country: result.country,
            location: result.location,
            title: result.title,
            type: result.type,
            areaValue: result.areaValue,
            areaUnit: result.areaUnit,
            bedrooms: result.bedrooms,
            bathrooms: result.bathrooms,
            hasGarage: result.hasGarage,
            garageSpaces: result.garageSpaces,
            description: result.description,
            availableFrom: new Date(result.availableFrom),
            availableFromText: new Date(result.availableFrom).toLocaleDateString(),
            ownerId: result.ownerId,
            currency: result.currency,
            salePrice: result.salePrice?.toString(),
            rentPrice: result.rentPrice?.toString(),
            hasCommonExpenses: result.hasCommonExpenses,
            commonExpensesValue: result.commonExpensesValue?.toString(),
            isElectricityIncluded: result.isElectricityIncluded,
            isWaterIncluded: result.isWaterIncluded,
            isPriceVisible: result.isPriceVisible,
            status: result.status,
            isActive: result.isActive,
            isPropertyVisible: result.isPropertyVisible,
            created: new Date(result.created),
            propertyImages: allImages.map(img => ({
                id: img.id,
                url: img.url,
                altText: img.altText,
                isMain: img.isMain,
                estatePropertyId: result.id,
                isPublic: img.isPublic,
                fileName: img.fileName
            })),
            propertyDocuments: allDocuments.map(doc => ({
                id: doc.id,
                url: doc.url,
                name: doc.name,
                estatePropertyId: result.id,
                fileName: doc.fileName,
                isPublic: doc.isPublic
            })),
            propertyVideos: videos.map(video => ({
                id: video.id,
                url: video.url,
                title: video.title,
                description: video.description,
                estatePropertyId: result.id,
                isPublic: video.isPublic
            })),
            amenities: [], // Would need to fetch these separately
            mainImageId: allImages.find(img => img.isMain)?.id,
            estatePropertyValues: result.estatePropertyValues || []
        };

    } catch (error: any) {
        console.error(`Error updating property ${id}:`, error.message);
        throw error;
    }
};

// Delete a property by its ID (soft delete)
const deleteProperty = async (id: string): Promise<void> => {
    try {
        const userId = await getCurrentUserId();

        // Get member ID for the user
        const { data: member, error: memberError } = await supabase
            .from('Members')
            .select('Id')
            .eq('UserId', userId)
            .eq('IsDeleted', false)
            .single();

        if (memberError) throw memberError;

        // Soft delete the property (only if user owns it)
        const { error } = await supabase
            .from('EstateProperties')
            .update({
                IsDeleted: true,
                LastModified: new Date().toISOString(),
                LastModifiedBy: userId
            })
            .eq('Id', id)
            .eq('OwnerId', member.Id)
            .eq('IsDeleted', false);

        if (error) throw error;
    } catch (error: any) {
        console.error(`Error deleting property ${id}:`, error.message);
        throw error;
    }
};

// Get all amenities for a property
const getAmenities = async (): Promise<Amenity[]> => {
    try {
        const { data, error } = await supabase
            .from('Amenities')
            .select('Id, Name, IconId')
            .eq('IsDeleted', false);

        if (error) throw error;

        return data?.map(amenity => ({
            id: amenity.Id,
            name: amenity.Name,
            iconId: amenity.IconId || undefined
        })) || [];
    } catch (error: any) {
        console.error(`Error fetching amenities:`, error.message);
        throw error;
    }
};

// Duplicate a property by its ID
const duplicateProperty = async (id: string): Promise<DuplicatedEstateProperty> => {
    try {
        const userId = await getCurrentUserId();

        const { data, error } = await supabase.rpc('duplicate_estate_property', {
            p_original_property_id: id,
            p_user_id: userId
        });

        if (error) throw error;

        return {
            newPropertyId: data.newPropertyId,
            title: data.title
        };
    } catch (error: any) {
        console.error(`Error duplicating property ${id}:`, error.message);
        throw error;
    }
};




// Get count of all owned properties (active, non-deleted)
const getOwnedPropertiesCount = async (user?: any): Promise<number> => {
    try {
        const userId = await getCurrentUserId(user);

        // Get the member ID for this user
        const { data: member, error: memberError } = await supabase
            .from('Members')
            .select('Id')
            .eq('UserId', userId)
            .eq('IsDeleted', false)
            .maybeSingle();

        if (memberError) throw memberError;
        if (!member) {
            return 0;
        }

        // Get company IDs that this user belongs to
        const { data: userCompanies, error: companiesError } = await supabase
            .from('UserCompanies')
            .select('CompanyId')
            .eq('MemberId', member.Id)
            .eq('IsDeleted', false);

        if (companiesError) throw companiesError;

        const companyIds = userCompanies?.map(uc => uc.CompanyId) || [];

        // Count all active, non-deleted properties owned by this member or their companies
        const { count, error } = await supabase
            .from('EstateProperties')
            .select('*, Owners!inner(OwnerType, MemberId, CompanyId)', { count: 'exact', head: true })
            .eq('IsDeleted', false)
            .or(`and(Owners.OwnerType.eq.member,Owners.MemberId.eq.${member.Id}),and(Owners.OwnerType.eq.company,Owners.CompanyId.in.(${companyIds.length > 0 ? companyIds.join(',') : 'null'}))`);

        if (error) throw error;

        return count || 0;
    } catch (error: any) {
        console.log('Error fetching owned properties count:', error.message);
        throw error;
    }
};

// Get count of published properties (visible/active)
const getPublishedPropertiesCount = async (user?: any): Promise<number> => {
    try {
        const userId = await getCurrentUserId(user);

        // Get the member ID for this user
        const { data: member, error: memberError } = await supabase
            .from('Members')
            .select('Id')
            .eq('UserId', userId)
            .eq('IsDeleted', false)
            .maybeSingle();

        if (memberError) throw memberError;
        if (!member) {
            return 0;
        }

        // Count all visible, active properties owned by this member
        const { count, error } = await supabase
            .from('EstateProperties')
            .select('*, Listings!inner(*)', { count: 'exact', head: true })
            .eq('OwnerId', member.Id)
            .eq('IsDeleted', false)
            .eq('Listings.IsDeleted', false)
            .eq('Listings.IsPropertyVisible', true)
            .eq('Listings.IsActive', true);

        if (error) throw error;

        return count || 0;
    } catch (error: any) {
        console.log('Error fetching published properties count:', error.message);
        throw error;
    }
};

const propertyService = {
    getProperties,
    getPropertiesInBounds,
    getUserProperties,
    getPropertyById,
    getOwnersProperties,
    getOwnersPropertyById,
    createProperty,
    createPropertyForOwner,
    updateProperty,
    deleteProperty,
    duplicateProperty,
    getAmenities,
    getOwnedPropertiesCount,
    getPublishedPropertiesCount
};

export default propertyService;