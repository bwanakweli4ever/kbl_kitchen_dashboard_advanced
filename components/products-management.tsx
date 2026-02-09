"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { toast } from "@/hooks/use-toast"
import { Plus, Edit, Trash2 } from "lucide-react"
import { config } from "@/lib/config"

// Helper function to resolve image URLs
function getImageUrl(imageUrl: string | undefined | null): string {
  if (!imageUrl) return ''
  
  // If it's already a full URL (http/https), return as is
  if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
    return imageUrl
  }
  
  // If it starts with /, it's a relative path - resolve it based on where images are hosted
  if (imageUrl.startsWith('/')) {
    // Images are hosted on the ordering website (kblbites.com)
    // Update this URL to match your actual image hosting location
    const imageBaseUrl = process.env.NEXT_PUBLIC_IMAGE_BASE_URL || 'https://kblbites.com'
    return `${imageBaseUrl}${imageUrl}`
  }
  
  return imageUrl
}

interface Product {
  id: number
  name: string
  display_name: string
  description?: string
  image_url?: string
  category?: string
  base_price: number
  available: boolean
  sort_order: number
}

interface Ingredient {
  id: number
  name: string
  display_name: string
  image_url?: string
  category?: string
  available: boolean
  price?: number
  available_as_addon?: boolean
}

interface Sauce {
  id: number
  name: string
  display_name: string
  description?: string
  available: boolean
}

interface Preset {
  id: number
  name: string
  display_name: string
  description?: string
  image_url?: string
  product_id: number
  /** Dynamic price from linked product (returned by API as product_base_price) */
  product_base_price?: number
  sauce_id?: number
  spice_level?: string
  category?: string
  calories?: number
  protein?: string
  carbs?: string
  fat?: string
  advice?: string
  rating?: number
  most_popular: boolean
  available: boolean
  ingredients?: Ingredient[]
}

interface ProductsManagementProps {
  token: string | null
}

export function ProductsManagement({ token }: ProductsManagementProps) {
  const [products, setProducts] = useState<Product[]>([])
  const [ingredients, setIngredients] = useState<Ingredient[]>([])
  const [sauces, setSauces] = useState<Sauce[]>([])
  const [presets, setPresets] = useState<Preset[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState("products")
  
  // Dialog states
  const [productDialogOpen, setProductDialogOpen] = useState(false)
  const [ingredientDialogOpen, setIngredientDialogOpen] = useState(false)
  const [presetDialogOpen, setPresetDialogOpen] = useState(false)
  const [editingProduct, setEditingProduct] = useState<Product | null>(null)
  const [editingIngredient, setEditingIngredient] = useState<Ingredient | null>(null)
  const [editingPreset, setEditingPreset] = useState<Preset | null>(null)

  // Form states
  const [productForm, setProductForm] = useState({
    name: "",
    display_name: "",
    description: "",
    image_url: "",
    category: "sandwich",
    base_price: 0,
    available: true,
    sort_order: 0,
  })

  const [ingredientForm, setIngredientForm] = useState({
    name: "",
    display_name: "",
    image_url: "",
    category: "vegetables",
    available: true,
    price: 0,
    available_as_addon: false,
  })

  const [presetForm, setPresetForm] = useState({
    name: "",
    display_name: "",
    description: "",
    image_url: "",
    product_id: 0,
    sauce_id: 0,
    spice_level: "mild",
    category: "sandwich",
    calories: 0,
    protein: "",
    carbs: "",
    fat: "",
    advice: "",
    rating: 0,
    most_popular: false,
    available: true,
    ingredient_ids: [] as number[],
  })

  useEffect(() => {
    if (token) {
      fetchAll()
    }
  }, [token])

  const fetchAll = async () => {
    if (!token) return
    setLoading(true)
    try {
      await Promise.all([
        fetchProducts(),
        fetchIngredients(),
        fetchSauces(),
        fetchPresets(),
      ])
    } finally {
      setLoading(false)
    }
  }

  const fetchProducts = async () => {
    if (!token) {
      console.warn("No token available for fetching products")
      return
    }
    
    try {
      console.log("Fetching products from /api/products...")
      const response = await fetch("/api/products", {
        headers: { 
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      })
      
      console.log("Products response status:", response.status)
      
      if (response.ok) {
        const data = await response.json()
        console.log("Products fetched:", data)
        
        // Ensure data is an array
        if (Array.isArray(data)) {
          setProducts(data)
          console.log(`✅ Loaded ${data.length} products`)
        } else {
          console.error("Products data is not an array:", data)
          setProducts([])
        }
      } else if (response.status === 404) {
        // 404 means endpoint doesn't exist - backend not deployed yet
        console.warn("Products API endpoint not found (404). Backend may need to be deployed.")
        toast({
          title: "Info",
          description: "Products API endpoint not available. Please deploy the updated backend or check if the server is running.",
          variant: "default",
        })
        setProducts([])
      } else {
        const errorText = await response.text()
        console.error("Error fetching products:", response.status, errorText)
        try {
          const errorJson = JSON.parse(errorText)
          toast({
            title: "Error",
            description: errorJson.error || errorJson.detail || `Failed to fetch products: ${response.status}`,
            variant: "destructive",
          })
        } catch {
          toast({
            title: "Error",
            description: `Failed to fetch products: ${response.status}`,
            variant: "destructive",
          })
        }
        setProducts([])
      }
    } catch (error) {
      console.error("Error fetching products:", error)
      toast({
        title: "Error",
        description: `Network error: ${error instanceof Error ? error.message : String(error)}`,
        variant: "destructive",
      })
      setProducts([])
    }
  }

  const fetchIngredients = async () => {
    try {
      const response = await fetch("/api/ingredients", {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (response.ok) {
        const data = await response.json()
        setIngredients(data)
      }
    } catch (error) {
      console.error("Error fetching ingredients:", error)
    }
  }

  const fetchSauces = async () => {
    try {
      const response = await fetch("/api/sauces", {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (response.ok) {
        const data = await response.json()
        setSauces(data)
      }
    } catch (error) {
      console.error("Error fetching sauces:", error)
    }
  }

  const fetchPresets = async () => {
    try {
      const response = await fetch("/api/presets?include_ingredients=true", {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (response.ok) {
        const data = await response.json()
        setPresets(data)
      }
    } catch (error) {
      console.error("Error fetching presets:", error)
    }
  }

  const handleCreateProduct = async () => {
    try {
      const response = await fetch("/api/products", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(productForm),
      })
      if (response.ok) {
        toast({ title: "Success", description: "Product created successfully" })
        setProductDialogOpen(false)
        resetProductForm()
        fetchProducts()
      } else {
        const error = await response.text()
        toast({ title: "Error", description: error, variant: "destructive" })
      }
    } catch (error) {
      toast({ title: "Error", description: "Failed to create product", variant: "destructive" })
    }
  }

  const handleUpdateProduct = async () => {
    if (!editingProduct) return
    try {
      const response = await fetch(`/api/products/${editingProduct.id}`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(productForm),
      })
      if (response.ok) {
        toast({ title: "Success", description: "Product updated successfully" })
        setProductDialogOpen(false)
        setEditingProduct(null)
        resetProductForm()
        fetchProducts()
      } else {
        const error = await response.text()
        toast({ title: "Error", description: error, variant: "destructive" })
      }
    } catch (error) {
      toast({ title: "Error", description: "Failed to update product", variant: "destructive" })
    }
  }

  const handleCreateIngredient = async () => {
    try {
      const response = await fetch("/api/ingredients", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(ingredientForm),
      })
      if (response.ok) {
        toast({ title: "Success", description: "Ingredient created successfully" })
        setIngredientDialogOpen(false)
        resetIngredientForm()
        fetchIngredients()
      } else {
        const error = await response.text()
        toast({ title: "Error", description: error, variant: "destructive" })
      }
    } catch (error) {
      toast({ title: "Error", description: "Failed to create ingredient", variant: "destructive" })
    }
  }

  const handleUpdateIngredient = async () => {
    if (!editingIngredient) return
    try {
      const response = await fetch(`/api/ingredients/${editingIngredient.id}`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(ingredientForm),
      })
      if (response.ok) {
        toast({ title: "Success", description: "Ingredient updated successfully" })
        setIngredientDialogOpen(false)
        setEditingIngredient(null)
        resetIngredientForm()
        fetchIngredients()
      } else {
        const error = await response.text()
        toast({ title: "Error", description: error, variant: "destructive" })
      }
    } catch (error) {
      toast({ title: "Error", description: "Failed to update ingredient", variant: "destructive" })
    }
  }

  const handleCreatePreset = async () => {
    try {
      const response = await fetch("/api/presets", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(presetForm),
      })
      if (response.ok) {
        toast({ title: "Success", description: "Preset created successfully" })
        setPresetDialogOpen(false)
        resetPresetForm()
        fetchPresets()
      } else {
        const error = await response.text()
        toast({ title: "Error", description: error, variant: "destructive" })
      }
    } catch (error) {
      toast({ title: "Error", description: "Failed to create preset", variant: "destructive" })
    }
  }

  const handleUpdatePreset = async () => {
    if (!editingPreset) return
    try {
      const response = await fetch(`/api/presets/${editingPreset.id}`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(presetForm),
      })
      if (response.ok) {
        toast({ title: "Success", description: "Preset updated successfully" })
        setPresetDialogOpen(false)
        setEditingPreset(null)
        resetPresetForm()
        fetchPresets()
      } else {
        const error = await response.text()
        toast({ title: "Error", description: error, variant: "destructive" })
      }
    } catch (error) {
      toast({ title: "Error", description: "Failed to update preset", variant: "destructive" })
    }
  }

  const resetProductForm = () => {
    setProductForm({
      name: "",
      display_name: "",
      description: "",
      image_url: "",
      category: "sandwich",
      base_price: 0,
      available: true,
      sort_order: 0,
    })
  }

  const resetIngredientForm = () => {
    setIngredientForm({
      name: "",
      display_name: "",
      image_url: "",
      category: "vegetables",
      available: true,
      price: 0,
      available_as_addon: false,
    })
  }

  const resetPresetForm = () => {
    setPresetForm({
      name: "",
      display_name: "",
      description: "",
      image_url: "",
      product_id: 0,
      sauce_id: 0,
      spice_level: "mild",
      category: "sandwich",
      calories: 0,
      protein: "",
      carbs: "",
      fat: "",
      advice: "",
      rating: 0,
      most_popular: false,
      available: true,
      ingredient_ids: [],
    })
  }

  const openEditProduct = (product: Product) => {
    setEditingProduct(product)
    setProductForm({
      name: product.name,
      display_name: product.display_name,
      description: product.description || "",
      image_url: product.image_url || "",
      category: product.category || "sandwich",
      base_price: product.base_price,
      available: product.available,
      sort_order: product.sort_order,
    })
    setProductDialogOpen(true)
  }

  const openEditIngredient = (ingredient: Ingredient) => {
    setEditingIngredient(ingredient)
    setIngredientForm({
      name: ingredient.name,
      display_name: ingredient.display_name,
      image_url: ingredient.image_url || "",
      category: ingredient.category || "vegetables",
      available: ingredient.available,
      price: ingredient.price ?? 0,
      available_as_addon: ingredient.available_as_addon ?? false,
    })
    setIngredientDialogOpen(true)
  }

  const openEditPreset = (preset: Preset) => {
    setEditingPreset(preset)
    setPresetForm({
      name: preset.name,
      display_name: preset.display_name,
      description: preset.description || "",
      image_url: preset.image_url || "",
      product_id: preset.product_id,
      sauce_id: preset.sauce_id || 0,
      spice_level: preset.spice_level || "mild",
      category: preset.category || "sandwich",
      calories: preset.calories || 0,
      protein: preset.protein || "",
      carbs: preset.carbs || "",
      fat: preset.fat || "",
      advice: preset.advice || "",
      rating: preset.rating || 0,
      most_popular: preset.most_popular,
      available: preset.available,
      ingredient_ids: preset.ingredients?.map(ing => ing.id) || [],
    })
    setPresetDialogOpen(true)
  }

  const toggleProductAvailability = async (product: Product) => {
    try {
      const response = await fetch(`/api/products/${product.id}`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ available: !product.available }),
      })
      if (response.ok) {
        toast({
          title: "Success",
          description: `Product ${product.available ? "disabled" : "enabled"} successfully`,
        })
        fetchProducts()
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update product",
        variant: "destructive",
      })
    }
  }

  const toggleIngredientAvailability = async (ingredient: Ingredient) => {
    try {
      const response = await fetch(`/api/ingredients/${ingredient.id}`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ available: !ingredient.available }),
      })
      if (response.ok) {
        toast({
          title: "Success",
          description: `Ingredient ${ingredient.available ? "disabled" : "enabled"} successfully`,
        })
        fetchIngredients()
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update ingredient",
        variant: "destructive",
      })
    }
  }

  const toggleSauceAvailability = async (sauce: Sauce) => {
    try {
      const response = await fetch(`/api/sauces/${sauce.id}`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ available: !sauce.available }),
      })
      if (response.ok) {
        toast({
          title: "Success",
          description: `Sauce ${sauce.available ? "disabled" : "enabled"} successfully`,
        })
        fetchSauces()
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update sauce",
        variant: "destructive",
      })
    }
  }

  if (loading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading products...</p>
          </div>
        </div>
      </div>
    )
  }
  
  if (!token) {
    return (
      <div className="p-6">
        <div className="text-center py-12">
          <p className="text-gray-600">Please log in to view products</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Products Management</h1>
        <Button onClick={fetchAll}>Refresh</Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="products">Products ({products.length})</TabsTrigger>
          <TabsTrigger value="ingredients">Ingredients ({ingredients.length})</TabsTrigger>
          <TabsTrigger value="sauces">Sauces ({sauces.length})</TabsTrigger>
          <TabsTrigger value="presets">Presets ({presets.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="products" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Products ({products.length})</CardTitle>
              <Dialog open={productDialogOpen} onOpenChange={setProductDialogOpen}>
                <DialogTrigger asChild>
                  <Button onClick={() => { setEditingProduct(null); resetProductForm(); }}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Product
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>{editingProduct ? "Edit Product" : "Create Product"}</DialogTitle>
                    <DialogDescription>
                      {editingProduct ? "Update product details" : "Add a new product to the menu"}
                    </DialogDescription>
                  </DialogHeader>
                  <div className="grid gap-4 py-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="name">Name (ID)</Label>
                        <Input
                          id="name"
                          value={productForm.name}
                          onChange={(e) => setProductForm({ ...productForm, name: e.target.value })}
                          placeholder="medium"
                        />
                      </div>
                      <div>
                        <Label htmlFor="display_name">Display Name</Label>
                        <Input
                          id="display_name"
                          value={productForm.display_name}
                          onChange={(e) => setProductForm({ ...productForm, display_name: e.target.value })}
                          placeholder="Medium Sandwich"
                        />
                      </div>
                    </div>
                    <div>
                      <Label htmlFor="description">Description</Label>
                      <Textarea
                        id="description"
                        value={productForm.description}
                        onChange={(e) => setProductForm({ ...productForm, description: e.target.value })}
                        placeholder="Product description"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="category">Category</Label>
                        <Select
                          value={productForm.category}
                          onValueChange={(value) => setProductForm({ ...productForm, category: value })}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="sandwich">Sandwich</SelectItem>
                            <SelectItem value="wrap">Wrap</SelectItem>
                            <SelectItem value="other">Other</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label htmlFor="base_price">Base Price (RWF)</Label>
                        <Input
                          id="base_price"
                          type="number"
                          value={productForm.base_price}
                          onChange={(e) => setProductForm({ ...productForm, base_price: parseFloat(e.target.value) || 0 })}
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="image_url">Image URL</Label>
                        <Input
                          id="image_url"
                          value={productForm.image_url}
                          onChange={(e) => setProductForm({ ...productForm, image_url: e.target.value })}
                          placeholder="/images/product.png"
                        />
                      </div>
                      <div>
                        <Label htmlFor="sort_order">Sort Order</Label>
                        <Input
                          id="sort_order"
                          type="number"
                          value={productForm.sort_order}
                          onChange={(e) => setProductForm({ ...productForm, sort_order: parseInt(e.target.value) || 0 })}
                        />
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Switch
                        id="available"
                        checked={productForm.available}
                        onCheckedChange={(checked) => setProductForm({ ...productForm, available: checked })}
                      />
                      <Label htmlFor="available">Available</Label>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => { setProductDialogOpen(false); resetProductForm(); }}>
                      Cancel
                    </Button>
                    <Button onClick={editingProduct ? handleUpdateProduct : handleCreateProduct}>
                      {editingProduct ? "Update" : "Create"}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Image</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Price</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {products.map((product) => (
                    <TableRow key={product.id}>
                      <TableCell>
                        {product.image_url ? (
                          <img 
                            src={getImageUrl(product.image_url)} 
                            alt={product.display_name}
                            className="w-16 h-16 object-cover rounded-md border border-gray-200"
                            onError={(e) => {
                              // Fallback if image fails to load
                              const target = e.currentTarget
                              target.src = '/images/placeholder.png'
                              target.onerror = null // Prevent infinite loop
                            }}
                            onLoad={() => {
                              console.log(`✅ Loaded product image: ${getImageUrl(product.image_url)}`)
                            }}
                          />
                        ) : (
                          <div className="w-16 h-16 bg-gray-200 rounded-md flex items-center justify-center text-gray-400 text-xs">
                            No Image
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="font-medium">{product.display_name}</TableCell>
                      <TableCell>{product.category || "N/A"}</TableCell>
                      <TableCell>{product.base_price.toLocaleString()} RWF</TableCell>
                      <TableCell>
                        <Badge variant={product.available ? "default" : "secondary"}>
                          {product.available ? "Available" : "Unavailable"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={product.available}
                            onCheckedChange={() => toggleProductAvailability(product)}
                          />
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openEditProduct(product)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="ingredients" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Ingredients</CardTitle>
              <Dialog open={ingredientDialogOpen} onOpenChange={setIngredientDialogOpen}>
                <DialogTrigger asChild>
                  <Button onClick={() => { setEditingIngredient(null); resetIngredientForm(); }}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Ingredient
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>{editingIngredient ? "Edit Ingredient" : "Create Ingredient"}</DialogTitle>
                  </DialogHeader>
                  <div className="grid gap-4 py-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="ing_name">Name (ID)</Label>
                        <Input
                          id="ing_name"
                          value={ingredientForm.name}
                          onChange={(e) => setIngredientForm({ ...ingredientForm, name: e.target.value })}
                        />
                      </div>
                      <div>
                        <Label htmlFor="ing_display_name">Display Name</Label>
                        <Input
                          id="ing_display_name"
                          value={ingredientForm.display_name}
                          onChange={(e) => setIngredientForm({ ...ingredientForm, display_name: e.target.value })}
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="ing_category">Category</Label>
                        <Select
                          value={ingredientForm.category}
                          onValueChange={(value) => setIngredientForm({ ...ingredientForm, category: value })}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="vegetables">Vegetables</SelectItem>
                            <SelectItem value="proteins">Proteins</SelectItem>
                            <SelectItem value="dairy">Dairy</SelectItem>
                            <SelectItem value="other">Other</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label htmlFor="ing_image_url">Image URL</Label>
                        <Input
                          id="ing_image_url"
                          value={ingredientForm.image_url}
                          onChange={(e) => setIngredientForm({ ...ingredientForm, image_url: e.target.value })}
                        />
                      </div>
                    </div>
                    <div>
                      <Label htmlFor="ing_price">Price (RWF) – for add-ons</Label>
                      <Input
                        id="ing_price"
                        type="number"
                        min={0}
                        value={ingredientForm.price}
                        onChange={(e) => setIngredientForm({ ...ingredientForm, price: parseFloat(e.target.value) || 0 })}
                        placeholder="0"
                      />
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="flex items-center space-x-2">
                        <Switch
                          id="ing_available"
                          checked={ingredientForm.available}
                          onCheckedChange={(checked) => setIngredientForm({ ...ingredientForm, available: checked })}
                        />
                        <Label htmlFor="ing_available">Available</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Switch
                          id="ing_available_as_addon"
                          checked={ingredientForm.available_as_addon}
                          onCheckedChange={(checked) => setIngredientForm({ ...ingredientForm, available_as_addon: checked })}
                        />
                        <Label htmlFor="ing_available_as_addon">Available as add-on</Label>
                      </div>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => { setIngredientDialogOpen(false); resetIngredientForm(); }}>
                      Cancel
                    </Button>
                    <Button onClick={editingIngredient ? handleUpdateIngredient : handleCreateIngredient}>
                      {editingIngredient ? "Update" : "Create"}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Image</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Price (RWF)</TableHead>
                    <TableHead>Add-on</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ingredients.map((ingredient) => (
                    <TableRow key={ingredient.id}>
                      <TableCell>
                        {ingredient.image_url ? (
                          <img 
                            src={getImageUrl(ingredient.image_url)} 
                            alt={ingredient.display_name}
                            className="w-12 h-12 object-cover rounded-md border border-gray-200"
                            onError={(e) => {
                              const target = e.currentTarget
                              target.src = '/images/placeholder.png'
                              target.onerror = null
                            }}
                            onLoad={() => {
                              console.log(`✅ Loaded ingredient image: ${getImageUrl(ingredient.image_url)}`)
                            }}
                          />
                        ) : (
                          <div className="w-12 h-12 bg-gray-200 rounded-md flex items-center justify-center text-gray-400 text-xs">
                            No Image
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="font-medium">{ingredient.display_name}</TableCell>
                      <TableCell>{ingredient.category || "N/A"}</TableCell>
                      <TableCell>{(ingredient.price ?? 0) > 0 ? (ingredient.price ?? 0).toLocaleString() : "—"}</TableCell>
                      <TableCell>
                        <Badge variant={ingredient.available_as_addon ? "default" : "outline"}>
                          {ingredient.available_as_addon ? "Add-on" : "—"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={ingredient.available ? "default" : "secondary"}>
                          {ingredient.available ? "Available" : "Unavailable"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={ingredient.available}
                            onCheckedChange={() => toggleIngredientAvailability(ingredient)}
                          />
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openEditIngredient(ingredient)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sauces" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Sauces ({sauces.length})</CardTitle>
              <p className="text-sm text-muted-foreground">List from API. Toggle to make unavailable.</p>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sauces.map((sauce) => (
                    <TableRow key={sauce.id}>
                      <TableCell className="font-medium">{sauce.display_name}</TableCell>
                      <TableCell>
                        <Badge variant={sauce.available ? "default" : "secondary"}>
                          {sauce.available ? "Available" : "Unavailable"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={sauce.available}
                            onCheckedChange={() => toggleSauceAvailability(sauce)}
                          />
                          <span className="text-xs text-muted-foreground">Make unavailable</span>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="presets" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Presets</CardTitle>
              <Dialog open={presetDialogOpen} onOpenChange={setPresetDialogOpen}>
                <DialogTrigger asChild>
                  <Button onClick={() => { setEditingPreset(null); resetPresetForm(); }}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Preset
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>{editingPreset ? "Edit Preset" : "Create Preset"}</DialogTitle>
                  </DialogHeader>
                  <div className="grid gap-4 py-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="preset_name">Name (ID)</Label>
                        <Input
                          id="preset_name"
                          value={presetForm.name}
                          onChange={(e) => setPresetForm({ ...presetForm, name: e.target.value })}
                        />
                      </div>
                      <div>
                        <Label htmlFor="preset_display_name">Display Name</Label>
                        <Input
                          id="preset_display_name"
                          value={presetForm.display_name}
                          onChange={(e) => setPresetForm({ ...presetForm, display_name: e.target.value })}
                        />
                      </div>
                    </div>
                    <div>
                      <Label htmlFor="preset_description">Description</Label>
                      <Textarea
                        id="preset_description"
                        value={presetForm.description}
                        onChange={(e) => setPresetForm({ ...presetForm, description: e.target.value })}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="preset_product">Product</Label>
                        <Select
                          value={presetForm.product_id.toString()}
                          onValueChange={(value) => setPresetForm({ ...presetForm, product_id: parseInt(value) })}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select product" />
                          </SelectTrigger>
                          <SelectContent>
                            {products.map((p) => (
                              <SelectItem key={p.id} value={p.id.toString()}>
                                {p.display_name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label htmlFor="preset_sauce">Sauce</Label>
                        <Select
                          value={presetForm.sauce_id?.toString() || "0"}
                          onValueChange={(value) => setPresetForm({ ...presetForm, sauce_id: value === "0" ? 0 : parseInt(value) })}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select sauce" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="0">None</SelectItem>
                            {sauces.map((s) => (
                              <SelectItem key={s.id} value={s.id.toString()}>
                                {s.display_name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div>
                      <Label>Price (RWF)</Label>
                      <div className="flex h-10 items-center rounded-md border border-input bg-muted/40 px-3 py-2 text-sm">
                        {(() => {
                          const fromPreset = editingPreset?.product_base_price
                          const product = presetForm.product_id > 0 ? products.find((p) => p.id === presetForm.product_id) : null
                          const fromProduct = product?.base_price
                          const price = fromPreset ?? fromProduct ?? 0
                          const source = fromPreset != null ? "loaded from menu" : fromProduct != null ? "from selected product" : null
                          return price > 0 ? (
                            <span>{price.toLocaleString()} RWF{source ? ` (${source})` : ""}</span>
                          ) : (
                            <span className="text-muted-foreground">Select a product — price loads from menu</span>
                          )
                        })()}
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="preset_spice">Spice Level</Label>
                        <Select
                          value={presetForm.spice_level}
                          onValueChange={(value) => setPresetForm({ ...presetForm, spice_level: value })}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">None</SelectItem>
                            <SelectItem value="mild">Mild</SelectItem>
                            <SelectItem value="spicy">Spicy</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label htmlFor="preset_category">Category</Label>
                        <Select
                          value={presetForm.category}
                          onValueChange={(value) => setPresetForm({ ...presetForm, category: value })}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="sandwich">Sandwich</SelectItem>
                            <SelectItem value="wrap">Wrap</SelectItem>
                            <SelectItem value="other">Other</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div>
                      <Label>Ingredients</Label>
                      <div className="grid grid-cols-3 gap-2 max-h-40 overflow-y-auto border p-2 rounded">
                        {ingredients.map((ing) => (
                          <div key={ing.id} className="flex items-center space-x-2">
                            <input
                              type="checkbox"
                              checked={presetForm.ingredient_ids.includes(ing.id)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setPresetForm({
                                    ...presetForm,
                                    ingredient_ids: [...presetForm.ingredient_ids, ing.id],
                                  })
                                } else {
                                  setPresetForm({
                                    ...presetForm,
                                    ingredient_ids: presetForm.ingredient_ids.filter((id) => id !== ing.id),
                                  })
                                }
                              }}
                            />
                            <Label className="text-sm">{ing.display_name}</Label>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="grid grid-cols-4 gap-4">
                      <div>
                        <Label htmlFor="preset_calories">Calories</Label>
                        <Input
                          id="preset_calories"
                          type="number"
                          value={presetForm.calories}
                          onChange={(e) => setPresetForm({ ...presetForm, calories: parseInt(e.target.value) || 0 })}
                        />
                      </div>
                      <div>
                        <Label htmlFor="preset_protein">Protein</Label>
                        <Input
                          id="preset_protein"
                          value={presetForm.protein}
                          onChange={(e) => setPresetForm({ ...presetForm, protein: e.target.value })}
                          placeholder="48g"
                        />
                      </div>
                      <div>
                        <Label htmlFor="preset_carbs">Carbs</Label>
                        <Input
                          id="preset_carbs"
                          value={presetForm.carbs}
                          onChange={(e) => setPresetForm({ ...presetForm, carbs: e.target.value })}
                          placeholder="65g"
                        />
                      </div>
                      <div>
                        <Label htmlFor="preset_fat">Fat</Label>
                        <Input
                          id="preset_fat"
                          value={presetForm.fat}
                          onChange={(e) => setPresetForm({ ...presetForm, fat: e.target.value })}
                          placeholder="38g"
                        />
                      </div>
                    </div>
                    <div>
                      <Label htmlFor="preset_advice">Advice</Label>
                      <Textarea
                        id="preset_advice"
                        value={presetForm.advice}
                        onChange={(e) => setPresetForm({ ...presetForm, advice: e.target.value })}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="preset_rating">Rating</Label>
                        <Input
                          id="preset_rating"
                          type="number"
                          step="0.1"
                          min="0"
                          max="5"
                          value={presetForm.rating}
                          onChange={(e) => setPresetForm({ ...presetForm, rating: parseFloat(e.target.value) || 0 })}
                        />
                      </div>
                      <div className="flex items-center space-x-2 pt-8">
                        <Switch
                          id="preset_most_popular"
                          checked={presetForm.most_popular}
                          onCheckedChange={(checked) => setPresetForm({ ...presetForm, most_popular: checked })}
                        />
                        <Label htmlFor="preset_most_popular">Most Popular</Label>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Switch
                        id="preset_available"
                        checked={presetForm.available}
                        onCheckedChange={(checked) => setPresetForm({ ...presetForm, available: checked })}
                      />
                      <Label htmlFor="preset_available">Available</Label>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => { setPresetDialogOpen(false); resetPresetForm(); }}>
                      Cancel
                    </Button>
                    <Button onClick={editingPreset ? handleUpdatePreset : handleCreatePreset}>
                      {editingPreset ? "Update" : "Create"}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Image</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Product</TableHead>
                    <TableHead>Price (RWF)</TableHead>
                    <TableHead>Ingredients</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {presets.map((preset) => {
                    const price = preset.product_base_price ?? products.find((p) => p.id === preset.product_id)?.base_price ?? 0
                    return (
                    <TableRow key={preset.id}>
                      <TableCell>
                        {preset.image_url ? (
                          <img 
                            src={getImageUrl(preset.image_url)} 
                            alt={preset.display_name}
                            className="w-16 h-16 object-cover rounded-md border border-gray-200"
                            onError={(e) => {
                              // Fallback if image fails to load
                              const target = e.currentTarget
                              target.src = '/images/placeholder.png'
                              target.onerror = null // Prevent infinite loop
                            }}
                            onLoad={() => {
                              console.log(`✅ Loaded preset image: ${getImageUrl(preset.image_url)}`)
                            }}
                          />
                        ) : (
                          <div className="w-16 h-16 bg-gray-200 rounded-md flex items-center justify-center text-gray-400 text-xs">
                            No Image
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="font-medium">{preset.display_name}</TableCell>
                      <TableCell>
                        {products.find((p) => p.id === preset.product_id)?.display_name || "N/A"}
                      </TableCell>
                      <TableCell>
                        {price > 0 ? price.toLocaleString() : "—"}
                      </TableCell>
                      <TableCell>
                        {preset.ingredients?.length || 0} ingredients
                      </TableCell>
                      <TableCell>
                        <Badge variant={preset.available ? "default" : "secondary"}>
                          {preset.available ? "Available" : "Unavailable"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openEditPreset(preset)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  )})}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
