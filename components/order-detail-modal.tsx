"use client"

import { useState, useEffect } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { 
  User, 
  Phone, 
  Clock, 
  CheckCircle,
  X,
  ZoomIn,
  Utensils,
  Droplets,
  Flame
} from "lucide-react"

// Helper function to get solid color and styling for ingredients
function getIngredientStyle(ingredientName: string): { bgColor: string; textColor: string; shadow: string } {
  const ing = ingredientName.toLowerCase().trim()
  
  // Red ingredients - Tomatoes, red peppers, red onions
  if (ing.includes('tomato') || (ing.includes('pepper') && ing.includes('red')) || 
      (ing.includes('onion') && ing.includes('red'))) {
    return {
      bgColor: 'bg-red-600',
      textColor: 'text-white',
      shadow: 'shadow-red-600/60'
    }
  }
  
  // Green vegetables - Lettuce, cabbage, cucumber, avocado, spinach, herbs
  if (ing.includes('lettuce') || ing.includes('cabbage') || ing.includes('cucumber') || 
      ing.includes('avocado') || ing.includes('spinach') || ing.includes('herb') ||
      ing.includes('green')) {
    return {
      bgColor: 'bg-green-600',
      textColor: 'text-white',
      shadow: 'shadow-green-600/60'
    }
  }
  
  // Yellow/Orange - Yellow peppers, corn, carrots
  if (ing.includes('yellow') || ing.includes('corn') || ing.includes('carrot') || 
      (ing.includes('pepper') && ing.includes('yellow'))) {
    return {
      bgColor: 'bg-yellow-500',
      textColor: 'text-gray-900',
      shadow: 'shadow-yellow-500/60'
    }
  }
  
  // Purple/White - Onions (general), purple cabbage
  if (ing.includes('onion') || (ing.includes('cabbage') && ing.includes('purple'))) {
    return {
      bgColor: 'bg-purple-600',
      textColor: 'text-white',
      shadow: 'shadow-purple-600/60'
    }
  }
  
  // Meat - Brown/Amber shades
  if (ing.includes('chicken') || ing.includes('beef') || ing.includes('lamb') || 
      ing.includes('pork') || ing.includes('meat') || ing.includes('turkey')) {
    return {
      bgColor: 'bg-amber-800',
      textColor: 'text-white',
      shadow: 'shadow-amber-800/60'
    }
  }
  
  // Cheese/Dairy - Light yellow
  if (ing.includes('cheese') || ing.includes('dairy') || ing.includes('cream') || 
      ing.includes('milk') || ing.includes('yogurt')) {
    return {
      bgColor: 'bg-yellow-300',
      textColor: 'text-gray-900',
      shadow: 'shadow-yellow-300/60'
    }
  }
  
  // Sauces/Condiments - Orange
  if (ing.includes('sauce') || ing.includes('mayo') || ing.includes('ketchup') || 
      ing.includes('mustard') || ing.includes('dressing')) {
    return {
      bgColor: 'bg-orange-600',
      textColor: 'text-white',
      shadow: 'shadow-orange-600/60'
    }
  }
  
  // Spices/Seasonings - Brown
  if (ing.includes('spice') || ing.includes('pepper') || ing.includes('salt') || 
      ing.includes('garlic') || ing.includes('ginger')) {
    return {
      bgColor: 'bg-amber-700',
      textColor: 'text-white',
      shadow: 'shadow-amber-700/60'
    }
  }
  
  // Default - Blue for unknown ingredients
  return {
    bgColor: 'bg-blue-600',
    textColor: 'text-white',
    shadow: 'shadow-blue-600/60'
  }
}

interface Order {
  id: number
  wa_id: string
  profile_name: string
  size: string
  quantity: number
  ingredients: string[]
  spice_level: string
  sauce: string
  food_total: number | null
  delivery_info: string
  delivery_latitude?: number | null
  delivery_longitude?: number | null
  delivery_address?: string | null
  status: string
  customer_total_orders: number
  created_at: string
  items?: string
  drinks?: string
  preset_name?: string
  payment_status?: string
  payment_received_at?: string
}

interface OrderDetailModalProps {
  order: Order | null
  open: boolean
  onOpenChange: (open: boolean) => void
  formatCurrency: (amount: number | null | undefined) => string
  calculateOrderTotal: (order: Order) => number
  getBreadChoice: (size: string | null | undefined, item?: any) => string
  getSizeDisplayName: (productName: string) => string
  getSpiceLevel: (level: string | null) => { color: string; icon: JSX.Element; label: string }
}

export function OrderDetailModal({
  order,
  open,
  onOpenChange,
  formatCurrency,
  calculateOrderTotal,
  getBreadChoice,
  getSizeDisplayName,
  getSpiceLevel,
}: OrderDetailModalProps) {
  const [ingredientsMap, setIngredientsMap] = useState<Record<string, string>>({})
  const [loadingIngredients, setLoadingIngredients] = useState(false)

  // Fetch ingredients when modal opens
  useEffect(() => {
    if (open) {
      const fetchIngredients = async () => {
        setLoadingIngredients(true)
        try {
          const token = getStoredToken()
          if (!token) {
            console.error("❌ No token available to fetch ingredients")
            setLoadingIngredients(false)
            return
          }

          console.log("🔍 Fetching ingredients from API...")
          console.log("🔑 Using token:", token ? `${token.substring(0, 20)}...` : 'NO TOKEN')
          
          // Try the Next.js API route first
          let response = await fetch("/api/ingredients", {
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
          })
          
          console.log("📡 Next.js API Response status:", response.status, response.statusText)
          
          // If Next.js API fails, try direct backend API
          if (!response.ok) {
            console.log("⚠️ Next.js API failed, trying direct backend API...")
            const backendUrl = `${config.api.baseUrl}/api/ingredients`
            console.log("🌐 Backend URL:", backendUrl)
            
            response = await fetch(backendUrl, {
              headers: {
                Authorization: `Bearer ${token}`,
                "Content-Type": "application/json",
              },
            })
            console.log("📡 Direct Backend API Response status:", response.status, response.statusText)
          }
          
          if (response.ok) {
            const ingredients = await response.json()
            console.log("✅ Fetched ingredients from API:", ingredients)
            console.log("📊 Total ingredients:", ingredients?.length || 0)
            
            if (!ingredients) {
              console.error("❌ No ingredients returned - response is null/undefined")
              setLoadingIngredients(false)
              return
            }
            
            if (!Array.isArray(ingredients)) {
              console.error("❌ Invalid response format - expected array, got:", typeof ingredients, ingredients)
              setLoadingIngredients(false)
              return
            }
            
            if (ingredients.length === 0) {
              console.warn("⚠️ API returned empty ingredients array - no ingredients in database")
              setLoadingIngredients(false)
              return
            }
            
            console.log("✅ Valid ingredients array received with", ingredients.length, "items")
            
            // Create a comprehensive map from ingredient name to image_url
            const map: Record<string, string> = {}
            
            ingredients.forEach((ing: any) => {
              const imageUrl = ing.image_url || ''
              
              // Helper to normalize strings for matching
              const normalize = (str: string): string[] => {
                if (!str) return []
                const lower = str.toLowerCase().trim()
                return [
                  lower,                                    // Original: "chicken-breast"
                  lower.replace(/-/g, ' '),                // "chicken breast"
                  lower.replace(/\s+/g, '-'),              // "chicken-breast" (if had spaces)
                  lower.replace(/[-\s_]/g, ''),            // "chickenbreast"
                  lower.replace(/[^\w]/g, ''),              // Remove all non-word chars
                ].filter(v => v && v.length > 0)
              }
              
              // Map by name field (even if no image_url, so we can match it)
              if (ing.name) {
                const variations = normalize(ing.name)
                variations.forEach(variation => {
                  map[variation] = imageUrl // Will be empty string if no image_url
                })
                if (imageUrl) {
                  console.log(`✅ Mapped "${ing.name}" (${variations.length} variations) -> ${imageUrl}`)
                } else {
                  console.warn(`⚠️ Mapped "${ing.name}" but has no image_url`)
                }
              }
              
              // Map by display_name field
              if (ing.display_name && ing.display_name !== ing.name) {
                const variations = normalize(ing.display_name)
                variations.forEach(variation => {
                  map[variation] = imageUrl // Will be empty string if no image_url
                })
                if (imageUrl) {
                  console.log(`✅ Mapped display_name "${ing.display_name}" (${variations.length} variations) -> ${imageUrl}`)
                } else {
                  console.warn(`⚠️ Mapped display_name "${ing.display_name}" but has no image_url`)
                }
              }
            })
            
            console.log("✅ Ingredients map created with", Object.keys(map).length, "keys")
            console.log("📋 All map keys:", Object.keys(map))
            
            // Log all ingredients with their images for debugging
            if (ingredients.length > 0) {
              console.table(ingredients.map((ing: any) => ({
                name: ing.name,
                display_name: ing.display_name,
                image_url: ing.image_url,
                hasImage: !!ing.image_url
              })))
            }
            
            setIngredientsMap(map)
          } else {
            const errorText = await response.text()
            console.error("❌ Failed to fetch ingredients:", {
              status: response.status,
              statusText: response.statusText,
              error: errorText
            })
          }
        } catch (error) {
          console.error("❌ Error fetching ingredients:", error)
          if (error instanceof Error) {
            console.error("Error details:", error.message, error.stack)
          }
        } finally {
          setLoadingIngredients(false)
        }
      }
      fetchIngredients()
    } else {
      // Reset map when modal closes
      setIngredientsMap({})
    }
  }, [open])

  // Helper function to get ingredient image URL from the API data
  const getIngredientImageUrl = (ingredientName: string): string | null => {
    if (!ingredientName || Object.keys(ingredientsMap).length === 0) {
      return null
    }
    
    // Normalize the input ingredient name (same logic as when creating the map)
    const normalize = (str: string): string[] => {
      if (!str) return []
      const lower = str.toLowerCase().trim()
      return [
        lower,                                    // Original: "chicken-breast"
        lower.replace(/-/g, ' '),                // "chicken breast"
        lower.replace(/\s+/g, '-'),              // "chicken-breast" (if had spaces)
        lower.replace(/[-\s_]/g, ''),            // "chickenbreast"
        lower.replace(/[^\w]/g, ''),              // Remove all non-word chars
      ].filter(v => v && v.length > 0)
    }
    
    const variations = normalize(ingredientName)
    
    // Try exact matches first
    for (const variation of variations) {
      if (ingredientsMap[variation] && ingredientsMap[variation].trim() !== '') {
        const imageUrl = ingredientsMap[variation]
        console.log(`✅ Found image for "${ingredientName}" (matched: "${variation}"): ${imageUrl}`)
        return imageUrl
      }
    }
    
    // Try fuzzy matching - find closest match
    const inputLower = ingredientName.toLowerCase().trim()
    const fuzzyMatch = Object.keys(ingredientsMap).find(key => {
      const keyLower = key.toLowerCase()
      // Check if one contains the other (at least 3 characters to avoid false matches)
      if (inputLower.length >= 3 && keyLower.length >= 3) {
        return keyLower.includes(inputLower) || inputLower.includes(keyLower)
      }
      return false
    })
    
    if (fuzzyMatch && ingredientsMap[fuzzyMatch] && ingredientsMap[fuzzyMatch].trim() !== '') {
      console.log(`✅ Fuzzy matched "${ingredientName}" -> "${fuzzyMatch}": ${ingredientsMap[fuzzyMatch]}`)
      return ingredientsMap[fuzzyMatch]
    }
    
    console.warn(`❌ No image found for ingredient: "${ingredientName}"`)
    console.log(`   Tried variations:`, variations)
    console.log(`   Available keys (first 10):`, Object.keys(ingredientsMap).slice(0, 10))
    return null
  }

  if (!order) return null

  // Parse items
  let items: any[] = []
  try {
    if (order.items) {
      items = typeof order.items === 'string' ? JSON.parse(order.items) : order.items
      if (!Array.isArray(items)) {
        items = []
      }
    }
    
    if (items.length === 0) {
      const orderIngredients = Array.isArray(order.ingredients) 
        ? order.ingredients 
        : (order.ingredients ? [order.ingredients] : [])
      items = [{
        size: order.size || '',
        quantity: order.quantity || 1,
        ingredients: orderIngredients,
        spice_level: order.spice_level || 'None',
        sauce: order.sauce || 'None',
        price: 0
      }]
    } else {
      items = items.map((item: any) => ({
        size: item.size || order.size || '',
        quantity: item.quantity || order.quantity || 1,
        ingredients: (item.ingredients && Array.isArray(item.ingredients) && item.ingredients.length > 0) 
          ? item.ingredients 
          : (Array.isArray(order.ingredients) && order.ingredients.length > 0 
              ? order.ingredients 
              : []),
        spice_level: (item.spice_level && item.spice_level !== 'None' && item.spice_level !== 'none' && item.spice_level !== '')
          ? item.spice_level
          : (order.spice_level && order.spice_level !== 'None' && order.spice_level !== 'none' && order.spice_level !== ''
              ? order.spice_level
              : 'None'),
        sauce: (item.sauce && item.sauce !== 'None' && item.sauce !== 'none' && item.sauce !== '')
          ? item.sauce
          : (order.sauce && order.sauce !== 'None' && order.sauce !== 'none' && order.sauce !== ''
              ? order.sauce
              : 'None'),
        price: item.price || 0
      }))
    }
  } catch (error) {
    console.error('Error parsing items:', error)
    items = []
  }

  // Parse drinks
  let drinks: any[] = []
  try {
    if (order.drinks) {
      if (typeof order.drinks === 'string') {
        drinks = JSON.parse(order.drinks)
      } else if (Array.isArray(order.drinks)) {
        drinks = order.drinks
      }
    }
    drinks = drinks.map((drink: any) => ({
      ...drink,
      name: drink.name ? drink.name.replace(/^,\s*/, '').trim() : 'Drink'
    }))
  } catch (error) {
    console.error('Error parsing drinks:', error)
    drinks = []
  }

  const spiceLevel = getSpiceLevel(order.spice_level)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[95vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-3xl font-bold text-center mb-4">
            Order #{order.id} - Kitchen View
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Food Items - Large Format for Kitchen */}
          <div className="bg-white rounded-lg p-6 border-2 border-gray-200">
            <h3 className="text-2xl font-bold mb-6 flex items-center gap-2">
              <Utensils className="h-6 w-6" />
              Food Items
            </h3>
            
            {items.map((item: any, idx: number) => {
              const itemIngredients: string[] = Array.isArray(item.ingredients) && item.ingredients.length > 0
                ? item.ingredients
                : (Array.isArray(order.ingredients) && order.ingredients.length > 0
                    ? order.ingredients
                    : [])
              
              let rawSize = item.size || order.size
              if (!rawSize || rawSize === 'N/A' || rawSize.trim() === '') {
                rawSize = order.size
              }
              const productName = getBreadChoice(rawSize, item)
              const displaySize = getSizeDisplayName(productName)
              
              let itemSpice = (item.spice_level && item.spice_level !== 'None' && item.spice_level !== 'none' && item.spice_level !== '')
                ? item.spice_level
                : (order.spice_level && order.spice_level !== 'None' && order.spice_level !== 'none' && order.spice_level !== ''
                    ? order.spice_level
                    : 'None')
              itemSpice = itemSpice.split('Drinks:')[0].split('🥤')[0].trim()
              
              let itemSauce = (item.sauce && item.sauce !== 'None' && item.sauce !== 'none' && item.sauce !== '')
                ? item.sauce
                : (order.sauce && order.sauce !== 'None' && order.sauce !== 'none' && order.sauce !== ''
                    ? order.sauce
                    : 'None')
              itemSauce = itemSauce
                .replace(/\s*[A-Za-z\s]+Wrap\s*x\d+.*?Price.*?RWF.*?/gi, '')
                .replace(/\s*[A-Za-z\s]+Sandwich\s*x\d+.*?Price.*?RWF.*?/gi, '')
                .replace(/\s*Price\s*[\d,]+\s*RWF.*?/gi, '')
                .replace(/\s*Total\s*[\d,]+\s*RWF.*?/gi, '')
                .replace(/\s*x\d+.*?/gi, '')
                .replace(/\s*Ingredients.*?$/gi, '')
                .split('Drinks:')[0]
                .split('🥤')[0]
                .split('Food Total:')[0]
                .split('Delivery:')[0]
                .replace(/\s*(Regular|Fresh|Signature)\s+Wrap\s*/gi, '')
                .replace(/\s*(Large|Medium|Small)\s+Sandwich\s*/gi, '')
                .replace(/\s*Shawarma\s*(Pro\s+Max)?\s*/gi, '')
                .replace(/[^\w\s-]/g, '')
                .replace(/\s+/g, ' ')
                .trim()
              
              if (!itemSauce || itemSauce === '') {
                itemSauce = 'None'
              }

              const itemSpiceLevel = getSpiceLevel(itemSpice)

              return (
                <div key={idx} className="mb-8 p-6 bg-gradient-to-br from-blue-50 to-green-50 rounded-xl border-2 border-blue-300">
                  <div className="flex items-center justify-between mb-4">
                    <div className="text-3xl font-bold text-gray-800">
                      Item #{idx + 1} - {displaySize}
                    </div>
                    <div className="text-2xl font-bold text-green-600">
                      ×{item.quantity || order.quantity || 1}
                    </div>
                  </div>

                  {/* Ingredients - Large and Easy to Read with Images */}
                  <div className="mb-6">
                    <div className="text-2xl font-bold text-gray-800 mb-4 flex items-center gap-2">
                      <Utensils className="h-6 w-6" />
                      Ingredients:
                    </div>
                    
                    {itemIngredients.length > 0 ? (
                      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
                        {itemIngredients.map((ing: string, ingIdx: number) => {
                          const ingredientName = ing.replace(/-/g, ' ').trim()
                          const style = getIngredientStyle(ingredientName)
                          
                          return (
                            <div
                              key={ingIdx}
                              className={`${style.bgColor} ${style.textColor} rounded-2xl shadow-2xl ${style.shadow} hover:shadow-3xl hover:scale-105 transition-all duration-300 flex items-center justify-center min-h-[140px] p-6 border-2 border-black/10`}
                            >
                              <div className="text-center">
                                <div className={`text-3xl md:text-4xl font-extrabold capitalize break-words`}
                                  style={{
                                    textShadow: style.textColor === 'text-white' 
                                      ? '2px 2px 4px rgba(0,0,0,0.5), 0 0 8px rgba(0,0,0,0.3)' 
                                      : '1px 1px 2px rgba(0,0,0,0.2)'
                                  }}
                                >
                                  {ingredientName}
                                </div>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    ) : (
                      <div className="text-gray-500 text-xl italic bg-gray-50 p-4 rounded-lg">No ingredients listed</div>
                    )}
                  </div>

                  {/* Spice and Sauce - Large Format */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-white p-6 rounded-lg border-2 border-orange-300 shadow-md">
                      <div className="text-xl font-bold text-gray-800 mb-3 flex items-center gap-2">
                        {itemSpiceLevel.icon}
                        Spice Level
                      </div>
                      <div className={`text-3xl font-bold capitalize ${itemSpiceLevel.color.replace('bg-', 'text-').replace('text-', '')}`}>
                        {itemSpice}
                      </div>
                    </div>
                    <div className="bg-white p-6 rounded-lg border-2 border-blue-300 shadow-md">
                      <div className="text-xl font-bold text-gray-800 mb-3 flex items-center gap-2">
                        <Droplets className="h-6 w-6" />
                        Sauce
                      </div>
                      <div className="text-3xl font-bold capitalize">
                        {itemSauce !== 'None' ? itemSauce.replace('-', ' ') : 'None'}
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Drinks */}
          {drinks.length > 0 && (
            <div className="bg-white rounded-lg p-6 border-2 border-gray-200">
              <h3 className="text-2xl font-bold mb-4 flex items-center gap-2">
                <span className="text-2xl">🥤</span>
                Drinks
              </h3>
              <div className="space-y-3">
                {drinks.map((drink: any, idx: number) => (
                  <div key={idx} className="bg-blue-50 p-4 rounded-lg border-2 border-blue-200">
                    <div className="flex items-center justify-between">
                      <div className="text-xl font-semibold">{drink.name || 'Drink'}</div>
                      <div className="text-lg text-gray-600">×{drink.quantity || 1}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Preset Info */}
          {order.preset_name && (
            <div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-lg p-6 border-2 border-purple-200">
              <div className="text-xl font-bold mb-2">Preset Order: {order.preset_name}</div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
