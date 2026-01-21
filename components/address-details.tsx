"use client"

import { useState, useEffect } from "react"
import { reverseGeocode, formatAddressForDelivery, type AddressDetails } from "@/lib/reverse-geocode"
import { MapPin, Building, Navigation, Mail } from "lucide-react"

interface AddressDetailsProps {
  latitude: number
  longitude: number
  initialAddress?: string
  showFullDetails?: boolean
}

export function AddressDetails({ latitude, longitude, initialAddress, showFullDetails = false }: AddressDetailsProps) {
  const [addressDetails, setAddressDetails] = useState<AddressDetails | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchAddress = async () => {
      if (!latitude || !longitude || isNaN(latitude) || isNaN(longitude)) {
        setLoading(false)
        return
      }

      try {
        const details = await reverseGeocode(latitude, longitude)
        setAddressDetails(details)
      } catch (error) {
        console.error('Failed to fetch address details:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchAddress()
  }, [latitude, longitude])

  if (loading) {
    return (
      <div className="text-sm text-gray-500">
        <span className="animate-pulse">📍 Loading address details...</span>
      </div>
    )
  }

  if (!addressDetails && !initialAddress) {
    return (
      <div className="text-sm text-gray-500">
        📍 {latitude.toFixed(6)}, {longitude.toFixed(6)}
      </div>
    )
  }

  if (showFullDetails && addressDetails) {
    return (
      <div className="space-y-3">
        {/* Primary Address */}
        {(addressDetails.houseNumber || addressDetails.street) && (
          <div className="flex items-start gap-2">
            <MapPin className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <div className="text-sm font-semibold text-gray-800">
                {addressDetails.houseNumber && addressDetails.street
                  ? `${addressDetails.houseNumber} ${addressDetails.street}`
                  : addressDetails.street || addressDetails.fullAddress}
              </div>
              {addressDetails.building && (
                <div className="text-xs text-gray-600 mt-1 flex items-center gap-1">
                  <Building className="h-3 w-3" />
                  {addressDetails.building}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Area/Neighborhood */}
        {addressDetails.neighborhood && (
          <div className="flex items-start gap-2">
            <Navigation className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <div className="text-xs text-gray-600 mb-1">Area/Neighborhood</div>
              <div className="text-sm font-medium text-gray-800">{addressDetails.neighborhood}</div>
            </div>
          </div>
        )}

        {/* City and District */}
        {(addressDetails.city || addressDetails.district) && (
          <div className="text-sm text-gray-700">
            {addressDetails.city}
            {addressDetails.district && `, ${addressDetails.district}`}
            {addressDetails.state && `, ${addressDetails.state}`}
          </div>
        )}

        {/* Landmark - Very helpful for delivery */}
        {addressDetails.landmark && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
            <div className="flex items-start gap-2">
              <span className="text-lg">🎯</span>
              <div className="flex-1">
                <div className="text-xs font-semibold text-yellow-800 mb-1">Nearby Landmark</div>
                <div className="text-sm font-bold text-yellow-900">{addressDetails.landmark}</div>
                <div className="text-xs text-yellow-700 mt-1">Look for this landmark to find the location</div>
              </div>
            </div>
          </div>
        )}

        {/* Postal Code */}
        {addressDetails.postalCode && (
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <Mail className="h-4 w-4" />
            <span>Postal Code: {addressDetails.postalCode}</span>
          </div>
        )}

        {/* Full Address Fallback */}
        {!addressDetails.houseNumber && !addressDetails.street && (
          <div className="text-sm text-gray-700">
            {addressDetails.displayAddress || initialAddress}
          </div>
        )}

        {/* Coordinates */}
        <div className="text-xs text-gray-500 font-mono border-t pt-2 mt-2">
          Coordinates: {latitude.toFixed(6)}, {longitude.toFixed(6)}
        </div>
      </div>
    )
  }

  // Compact view
  if (addressDetails) {
    const formatted = formatAddressForDelivery(addressDetails)
    return (
      <div className="space-y-1">
        <div className="text-sm font-semibold text-gray-800">
          {addressDetails.houseNumber && addressDetails.street
            ? `${addressDetails.houseNumber} ${addressDetails.street}`
            : addressDetails.street || formatted}
        </div>
        {addressDetails.building && (
          <div className="text-xs text-gray-600">🏢 {addressDetails.building}</div>
        )}
        {addressDetails.neighborhood && (
          <div className="text-xs text-gray-600">📍 {addressDetails.neighborhood}</div>
        )}
        {addressDetails.city && (
          <div className="text-xs text-gray-600">{addressDetails.city}</div>
        )}
        {addressDetails.landmark && (
          <div className="text-xs text-blue-600 font-medium">🎯 Near: {addressDetails.landmark}</div>
        )}
      </div>
    )
  }

  return (
    <div className="text-sm text-gray-700">
      {initialAddress || `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`}
    </div>
  )
}
