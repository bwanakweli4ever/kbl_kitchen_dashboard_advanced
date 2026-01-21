/**
 * Reverse geocoding utility to convert coordinates to detailed addresses
 * Uses OpenStreetMap Nominatim API (free, no API key required)
 */

export interface AddressDetails {
  fullAddress: string
  street?: string
  houseNumber?: string
  neighborhood?: string
  suburb?: string
  city?: string
  district?: string
  state?: string
  country?: string
  postalCode?: string
  building?: string
  landmark?: string
  displayAddress: string // Formatted address for display
}

/**
 * Reverse geocode coordinates to get detailed address information
 * Uses OpenStreetMap Nominatim API with high detail level
 * 
 * This function converts GPS coordinates (latitude, longitude) into a detailed
 * street address including:
 * - House/building number
 * - Street name
 * - Building name
 * - Neighborhood/Area
 * - City
 * - District
 * - Nearby landmarks (amenities, shops, etc.)
 * - Postal code
 * 
 * @param latitude - GPS latitude coordinate
 * @param longitude - GPS longitude coordinate
 * @returns Promise resolving to AddressDetails or null if geocoding fails
 */
export async function reverseGeocode(
  latitude: number,
  longitude: number,
  retries: number = 2
): Promise<AddressDetails | null> {
  // Validate coordinates
  if (isNaN(latitude) || isNaN(longitude) || 
      latitude < -90 || latitude > 90 || 
      longitude < -180 || longitude > 180) {
    console.error('Invalid coordinates:', latitude, longitude)
    return null
  }

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      // Use OpenStreetMap Nominatim API for reverse geocoding
      // zoom=18 provides building-level detail, addressdetails=1 gets structured address
      // namedetails=1 gets place names, extratags=1 gets additional tags
      const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=18&addressdetails=1&namedetails=1&extratags=1`
      
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'KBL-Bites-Delivery-System/1.0', // Required by Nominatim
          'Accept-Language': 'en', // Prefer English for address names
        },
      })

      if (!response.ok) {
        // If rate limited (429), wait before retry
        if (response.status === 429 && attempt < retries) {
          await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)))
          continue
        }
        throw new Error(`Reverse geocoding failed: ${response.status}`)
      }

    const data = await response.json()

    if (!data || !data.address) {
      return null
    }

    const addr = data.address

    // Extract house number from various possible fields
    const houseNumber = 
      addr.house_number || 
      addr.housenumber || 
      addr['addr:housenumber'] ||
      addr.house ||
      undefined

    // Extract street name from various possible fields
    const street = 
      addr.road || 
      addr.street || 
      addr['addr:street'] ||
      addr.pedestrian || 
      addr.path ||
      addr.footway ||
      addr.residential ||
      addr.cycleway ||
      undefined

    // Extract building information
    const building = 
      addr.building || 
      addr['addr:building'] ||
      addr.building_name ||
      addr.name || // Sometimes building name is in 'name' field
      undefined

    // Extract neighborhood/area information
    const neighborhood = 
      addr.neighbourhood || 
      addr.neighborhood ||
      addr['addr:neighbourhood'] ||
      addr.suburb ||
      addr.quarter ||
      addr.city_block ||
      undefined

    // Extract city/town information
    const city = 
      addr.city || 
      addr.town || 
      addr.village || 
      addr.municipality ||
      addr.city_district ||
      addr.district ||
      undefined

    // Extract district/county
    const district = 
      addr.county || 
      addr.district ||
      addr.city_district ||
      addr.state_district ||
      undefined

    // Extract landmark/amenity (very helpful for delivery)
    const landmark = 
      addr.amenity || 
      addr.landmark ||
      addr.place ||
      addr.shop ||
      addr.office ||
      addr.leisure ||
      addr.tourism ||
      (data.extratags && data.extratags.amenity) ||
      undefined

    // Extract postal code
    const postalCode = 
      addr.postcode || 
      addr.postal_code ||
      addr['addr:postcode'] ||
      undefined

    // Build full address components in logical order
    const addressParts: string[] = []

    // Primary address (house number + street) - most important for delivery
    if (houseNumber && street) {
      addressParts.push(`${houseNumber} ${street}`)
    } else if (street) {
      addressParts.push(street)
    } else if (houseNumber) {
      addressParts.push(`House ${houseNumber}`)
    }

    // Building name (if different from street address)
    if (building && building !== street) {
      addressParts.push(building)
    }

    // Neighborhood/Area
    if (neighborhood) {
      addressParts.push(neighborhood)
    }

    // City
    if (city) {
      addressParts.push(city)
    }

    // District/County
    if (district && district !== city) {
      addressParts.push(district)
    }

    // State/Province
    if (addr.state) {
      addressParts.push(addr.state)
    }

    // Postal code
    if (postalCode) {
      addressParts.push(postalCode)
    }

    // Country
    if (addr.country) {
      addressParts.push(addr.country)
    }

    const fullAddress = addressParts.join(', ')
    const displayAddress = fullAddress || data.display_name || `${latitude}, ${longitude}`

    return {
      fullAddress: data.display_name || fullAddress,
      street: street,
      houseNumber: houseNumber,
      neighborhood: neighborhood,
      suburb: addr.suburb || neighborhood,
      city: city,
      district: district,
      state: addr.state || undefined,
      country: addr.country || undefined,
      postalCode: postalCode,
      building: building,
      landmark: landmark,
      displayAddress,
    }
    } catch (error) {
      // Log error but retry if attempts remain
      if (attempt < retries) {
        console.warn(`Reverse geocoding attempt ${attempt + 1} failed, retrying...`, error)
        await new Promise(resolve => setTimeout(resolve, 500 * (attempt + 1)))
        continue
      }
      console.error('Reverse geocoding error after all retries:', error)
      // Return null on error - caller can handle fallback
      return null
    }
  }
  
  // If we get here, all retries failed
  return null
}

/**
 * Format address details for delivery team display
 * Prioritizes information most useful for finding the location
 */
export function formatAddressForDelivery(address: AddressDetails): string {
  const parts: string[] = []

  // Primary address (house number + street) - CRITICAL for delivery
  if (address.houseNumber && address.street) {
    parts.push(`${address.houseNumber} ${address.street}`)
  } else if (address.street) {
    parts.push(address.street)
  } else if (address.houseNumber) {
    parts.push(`House Number: ${address.houseNumber}`)
  }

  // Building name (very helpful if available)
  if (address.building && address.building !== address.street) {
    parts.push(`Building: ${address.building}`)
  }

  // Neighborhood/Area (helps narrow down location)
  if (address.neighborhood) {
    parts.push(`Area: ${address.neighborhood}`)
  }

  // City
  if (address.city) {
    parts.push(address.city)
  }

  // District (broader area context)
  if (address.district && address.district !== address.city) {
    parts.push(address.district)
  }

  // Landmark (EXTREMELY helpful for delivery - e.g., "Near Kigali Convention Centre")
  if (address.landmark) {
    parts.push(`📍 Near: ${address.landmark}`)
  }

  // Postal code (for reference)
  if (address.postalCode) {
    parts.push(`Postal: ${address.postalCode}`)
  }

  return parts.length > 0 ? parts.join(', ') : address.displayAddress
}
