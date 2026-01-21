"use client"

import { useState, useEffect } from "react"
import { reverseGeocode, type AddressDetails } from "@/lib/reverse-geocode"

interface DeliveryMapProps {
  latitude: number
  longitude: number
  address?: string
  height?: string
  zoom?: number
  id?: string | number
}

// Address display component - shows detailed address without map
function AddressDisplay({ latitude, longitude, address }: { latitude: number; longitude: number; address?: string }) {
  const [addressDetails, setAddressDetails] = useState<AddressDetails | null>(null)
  const [loadingAddress, setLoadingAddress] = useState(false)

  // Fetch detailed address from coordinates
  useEffect(() => {
    const fetchAddress = async () => {
      if (!latitude || !longitude || isNaN(latitude) || isNaN(longitude)) {
        return
      }

      setLoadingAddress(true)
      try {
        const details = await reverseGeocode(latitude, longitude)
        if (details) {
          setAddressDetails(details)
        }
      } catch (error) {
        console.error('Failed to fetch address details:', error)
      } finally {
        setLoadingAddress(false)
      }
    }

    fetchAddress()
  }, [latitude, longitude])

  return (
    <div className="bg-white rounded-lg border-2 border-blue-200 p-6 space-y-4">
      {/* Address Details */}
      <div className="space-y-3">
        {loadingAddress ? (
          <div className="text-sm text-gray-500">Loading address...</div>
        ) : addressDetails ? (
          <>
            {/* Street Address */}
            {addressDetails.houseNumber && addressDetails.street ? (
              <div>
                <div className="text-xs text-gray-600 mb-1">Street Address</div>
                <div className="text-base font-semibold text-gray-800">
                  {addressDetails.houseNumber} {addressDetails.street}
                </div>
              </div>
            ) : addressDetails.street ? (
              <div>
                <div className="text-xs text-gray-600 mb-1">Street Address</div>
                <div className="text-base font-semibold text-gray-800">
                  {addressDetails.street}
                </div>
              </div>
            ) : null}

            {/* Area/Neighborhood */}
            {addressDetails.neighborhood && (
              <div>
                <div className="text-xs text-gray-600 mb-1">Area/Neighborhood</div>
                <div className="text-base text-gray-800">{addressDetails.neighborhood}</div>
              </div>
            )}

            {/* City and District */}
            {(addressDetails.city || addressDetails.district) && (
              <div>
                <div className="text-xs text-gray-600 mb-1">City/District</div>
                <div className="text-base text-gray-800">
                  {addressDetails.city || ''}
                  {addressDetails.city && addressDetails.district && ', '}
                  {addressDetails.district}
                </div>
              </div>
            )}

            {/* Building */}
            {addressDetails.building && (
              <div>
                <div className="text-xs text-gray-600 mb-1">Building</div>
                <div className="text-base text-gray-800">🏢 {addressDetails.building}</div>
              </div>
            )}

            {/* Landmark */}
            {addressDetails.landmark && (
              <div>
                <div className="text-xs text-gray-600 mb-1">Nearby Landmark</div>
                <div className="text-base text-blue-600 font-medium">🎯 {addressDetails.landmark}</div>
              </div>
            )}
          </>
        ) : address ? (
          <div>
            <div className="text-xs text-gray-600 mb-1">Address</div>
            <div className="text-base text-gray-800">{address}</div>
          </div>
        ) : null}

        {/* Coordinates */}
        <div>
          <div className="text-xs text-gray-600 mb-1">Coordinates</div>
          <div className="text-sm font-mono text-gray-700">
            {latitude.toFixed(6)}, {longitude.toFixed(6)}
          </div>
        </div>
      </div>

      {/* Google Maps Button */}
      <div className="pt-4 border-t">
        <a
          href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${latitude},${longitude}`)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-medium shadow-md transition-colors"
        >
          <span>📍</span>
          Open in Google Maps
        </a>
      </div>
    </div>
  )
}

export function DeliveryMap({ latitude, longitude, address, height, zoom, id }: DeliveryMapProps) {
  // Validate coordinates
  if (!latitude || !longitude || isNaN(latitude) || isNaN(longitude)) {
    return (
      <div className="flex items-center justify-center p-6 bg-gray-100 rounded-lg border-2 border-gray-300">
        <div className="text-center text-gray-600">
          <span className="text-2xl mb-2 block">📍</span>
          <p className="text-sm">Invalid coordinates</p>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full">
      <AddressDisplay
        latitude={latitude}
        longitude={longitude}
        address={address}
      />
    </div>
  )
}

// Helper function to parse coordinates from delivery_info string
export function parseCoordinates(deliveryInfo: string): { latitude: number | null; longitude: number | null; address: string } {
  if (!deliveryInfo || typeof deliveryInfo !== 'string') {
    return { latitude: null, longitude: null, address: deliveryInfo || '' }
  }

  // Try to extract coordinates from various formats
  // Format 1: "Lat: X, Lng: Y"
  const latLngMatch = deliveryInfo.match(/(?:lat|latitude)[:\s]+(-?\d+\.?\d*)[,\s]+(?:lng|longitude)[:\s]+(-?\d+\.?\d*)/i)
  if (latLngMatch) {
    const lat = parseFloat(latLngMatch[1])
    const lng = parseFloat(latLngMatch[2])
    if (!isNaN(lat) && !isNaN(lng)) {
      return { latitude: lat, longitude: lng, address: deliveryInfo }
    }
  }

  // Format 2: "X, Y" (comma-separated)
  const commaMatch = deliveryInfo.match(/^(-?\d+\.?\d*)[,\s]+(-?\d+\.?\d*)$/)
  if (commaMatch) {
    const lat = parseFloat(commaMatch[1])
    const lng = parseFloat(commaMatch[2])
    if (!isNaN(lat) && !isNaN(lng)) {
      return { latitude: lat, longitude: lng, address: deliveryInfo }
    }
  }

  // Format 3: Contains coordinates somewhere in the string
  const anyCoordMatch = deliveryInfo.match(/(-?\d+\.\d+)[,\s]+(-?\d+\.\d+)/)
  if (anyCoordMatch) {
    const lat = parseFloat(anyCoordMatch[1])
    const lng = parseFloat(anyCoordMatch[2])
    if (!isNaN(lat) && !isNaN(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
      return { latitude: lat, longitude: lng, address: deliveryInfo }
    }
  }

  // No coordinates found, return as address
  return { latitude: null, longitude: null, address: deliveryInfo }
}
