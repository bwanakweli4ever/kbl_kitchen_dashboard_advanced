"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, Edit, Loader2, GripVertical, X } from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface Preset {
  id: number;
  display_name: string;
  preset_price?: number;
  product_base_price?: number;
}

interface Ingredient {
  id: number;
  display_name: string;
  price?: number;
  available_as_addon?: boolean;
}

interface Drink {
  id: number;
  display_name: string;
  price?: number;
  available?: boolean;
}

interface ComboItemIn {
  item_type: "preset" | "ingredient" | "drink";
  item_id: number;
  quantity: number;
  display_label: string;
  sort_order: number;
}

interface ComboItemOut extends ComboItemIn {
  id: number;
  resolved_name: string;
  unit_price: number;
}

interface Combo {
  id: number;
  name: string;
  display_name: string;
  description?: string;
  image_url?: string;
  combo_price: number;
  available: boolean;
  sort_order: number;
  items: ComboItemOut[];
  a_la_carte_total: number;
}

interface CombosManagementProps {
  token: string | null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function formatRWF(n: number) {
  return `${Math.round(n).toLocaleString()} RWF`;
}

function slugify(s: string) {
  return s
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function getImageUrl(imageUrl?: string | null) {
  if (!imageUrl) return "";
  if (imageUrl.startsWith("http://") || imageUrl.startsWith("https://")) {
    return imageUrl;
  }
  if (imageUrl.startsWith("/")) {
    const imageBaseUrl = process.env.NEXT_PUBLIC_IMAGE_BASE_URL || "https://kblbites.com";
    return `${imageBaseUrl}${imageUrl}`;
  }
  return imageUrl;
}

const emptyForm = () => ({
  name: "",
  display_name: "",
  description: "",
  image_url: "",
  combo_price: 0,
  available: true,
  sort_order: 0,
  items: [] as ComboItemIn[],
});

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------
export function CombosManagement({ token }: CombosManagementProps) {
  const { toast } = useToast();

  const [combos, setCombos] = useState<Combo[]>([]);
  const [presets, setPresets] = useState<Preset[]>([]);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [drinks, setDrinks] = useState<Drink[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCombo, setEditingCombo] = useState<Combo | null>(null);
  const [form, setForm] = useState(emptyForm());

  // Item picker state
  const [pickerType, setPickerType] = useState<"preset" | "ingredient" | "drink">("preset");
  const [pickerSearch, setPickerSearch] = useState("");

  // ---------------------------------------------------------------------------
  // Fetch helpers
  // ---------------------------------------------------------------------------
  const headers = useCallback(
    () => ({
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    }),
    [token]
  );

  const fetchData = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const [combosRes, presetsRes, ingredientsRes, drinksRes] = await Promise.all([
        fetch("/api/combos", { headers: headers() }),
        fetch("/api/presets", { headers: headers() }),
        fetch("/api/ingredients?addons_only=false", { headers: headers() }),
        fetch("/api/drinks", { headers: headers() }),
      ]);
      const [combosData, presetsData, ingredientsData, drinksData] = await Promise.all([
        combosRes.json(),
        presetsRes.json(),
        ingredientsRes.json(),
        drinksRes.json(),
      ]);
      setCombos(Array.isArray(combosData) ? combosData : []);
      setPresets(Array.isArray(presetsData) ? presetsData : []);
      setIngredients(Array.isArray(ingredientsData) ? ingredientsData : []);
      setDrinks(Array.isArray(drinksData) ? drinksData : []);
    } catch (e) {
      toast({ title: "Failed to load combos", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [token, headers, toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // ---------------------------------------------------------------------------
  // Dialog open/close
  // ---------------------------------------------------------------------------
  function openCreate() {
    setEditingCombo(null);
    setForm(emptyForm());
    setPickerSearch("");
    setDialogOpen(true);
  }

  function openEdit(combo: Combo) {
    setEditingCombo(combo);
    setForm({
      name: combo.name,
      display_name: combo.display_name,
      description: combo.description ?? "",
      image_url: combo.image_url ?? "",
      combo_price: combo.combo_price,
      available: combo.available,
      sort_order: combo.sort_order,
      items: combo.items.map((it) => ({
        item_type: it.item_type,
        item_id: it.item_id,
        quantity: it.quantity,
        display_label: it.display_label ?? it.resolved_name ?? "",
        sort_order: it.sort_order,
      })),
    });
    setPickerSearch("");
    setDialogOpen(true);
  }

  // ---------------------------------------------------------------------------
  // Save (create or update)
  // ---------------------------------------------------------------------------
  async function handleSave() {
    if (!form.display_name.trim()) {
      toast({ title: "Display name is required", variant: "destructive" });
      return;
    }
    if (form.combo_price <= 0) {
      toast({ title: "Combo price must be > 0", variant: "destructive" });
      return;
    }
    if (form.items.length === 0) {
      toast({ title: "Add at least one item to the combo", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      const payload = {
        ...form,
        name: form.name || slugify(form.display_name),
        image_url: form.image_url.trim() || undefined,
      };

      let res: Response;
      if (editingCombo) {
        res = await fetch(`/api/combos?__id=${editingCombo.id}`, {
          method: "PUT",
          headers: headers(),
          body: JSON.stringify(payload),
        });
      } else {
        res = await fetch("/api/combos", {
          method: "POST",
          headers: headers(),
          body: JSON.stringify(payload),
        });
      }

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail ?? res.statusText);
      }

      toast({ title: editingCombo ? "Combo updated" : "Combo created" });
      setDialogOpen(false);
      fetchData();
    } catch (e: unknown) {
      toast({
        title: "Save failed",
        description: e instanceof Error ? e.message : String(e),
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  }

  // ---------------------------------------------------------------------------
  // Delete
  // ---------------------------------------------------------------------------
  async function handleDelete(combo: Combo) {
    if (!confirm(`Delete "${combo.display_name}"? This cannot be undone.`)) return;
    try {
      const res = await fetch(`/api/combos?__id=${combo.id}`, {
        method: "DELETE",
        headers: headers(),
      });
      if (!res.ok && res.status !== 204) throw new Error(res.statusText);
      toast({ title: "Combo deleted" });
      fetchData();
    } catch (e: unknown) {
      toast({
        title: "Delete failed",
        description: e instanceof Error ? e.message : String(e),
        variant: "destructive",
      });
    }
  }

  // ---------------------------------------------------------------------------
  // Item picker logic
  // ---------------------------------------------------------------------------
  const filteredPickerItems =
    pickerType === "preset"
      ? presets.filter((p) =>
          p.display_name.toLowerCase().includes(pickerSearch.toLowerCase())
        )
      : pickerType === "drink"
      ? drinks.filter((d) =>
          d.display_name.toLowerCase().includes(pickerSearch.toLowerCase())
        )
      : ingredients.filter((i) =>
          i.display_name.toLowerCase().includes(pickerSearch.toLowerCase())
        );

  function addItem(type: "preset" | "ingredient" | "drink", id: number, name: string, price: number) {
    const alreadyIdx = form.items.findIndex(
      (it) => it.item_type === type && it.item_id === id
    );
    if (alreadyIdx >= 0) {
      // increment quantity
      const updated = [...form.items];
      updated[alreadyIdx] = {
        ...updated[alreadyIdx],
        quantity: updated[alreadyIdx].quantity + 1,
      };
      setForm((f) => ({ ...f, items: updated }));
    } else {
      const newItem: ComboItemIn = {
        item_type: type,
        item_id: id,
        quantity: 1,
        display_label: name,
        sort_order: form.items.length,
      };
      setForm((f) => ({ ...f, items: [...f.items, newItem] }));
    }
  }

  function removeItem(idx: number) {
    setForm((f) => ({ ...f, items: f.items.filter((_, i) => i !== idx) }));
  }

  function updateItemQty(idx: number, qty: number) {
    if (qty < 1) return;
    const updated = [...form.items];
    updated[idx] = { ...updated[idx], quantity: qty };
    setForm((f) => ({ ...f, items: updated }));
  }

  // Compute a-la-carte total for the form items
  const formALaCarteTotal = form.items.reduce((sum, it) => {
    if (it.item_type === "preset") {
      const p = presets.find((pr) => pr.id === it.item_id);
      return sum + (p?.preset_price ?? p?.product_base_price ?? 0) * it.quantity;
    } else if (it.item_type === "drink") {
      const d = drinks.find((dr) => dr.id === it.item_id);
      return sum + (d?.price ?? 0) * it.quantity;
    } else {
      const i = ingredients.find((ig) => ig.id === it.item_id);
      return sum + (i?.price ?? 0) * it.quantity;
    }
  }, 0);

  const savings = formALaCarteTotal - form.combo_price;

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
        <span className="ml-2 text-gray-600">Loading combos…</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Combo Packages</h2>
          <p className="text-sm text-gray-500 mt-1">
            Bundle presets + add-ons into dynamic meal deals (e.g. Taco + Drink + Chips)
          </p>
        </div>
        <Button onClick={openCreate} className="bg-orange-500 hover:bg-orange-600 text-white gap-2">
          <Plus className="h-4 w-4" /> New Combo
        </Button>
      </div>

      {/* Combo cards */}
      {combos.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center text-gray-400">
            <p className="text-lg font-medium">No combos yet</p>
            <p className="text-sm mt-1">Create your first combo package above.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {combos.map((combo) => {
            const saving = combo.a_la_carte_total - combo.combo_price;
            return (
              <Card key={combo.id} className="relative flex flex-col">
                {combo.image_url && (
                  <div className="h-36 overflow-hidden border-b bg-gray-50 rounded-t-xl">
                    <img
                      src={getImageUrl(combo.image_url)}
                      alt={combo.display_name}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        const target = e.currentTarget;
                        target.style.display = "none";
                      }}
                    />
                  </div>
                )}
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <CardTitle className="text-base">{combo.display_name}</CardTitle>
                      <CardDescription className="text-xs mt-0.5">{combo.name}</CardDescription>
                    </div>
                    <Badge variant={combo.available ? "default" : "secondary"}>
                      {combo.available ? "Active" : "Hidden"}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="flex-1 space-y-3">
                  {/* Items list */}
                  <ul className="space-y-1 text-sm">
                    {combo.items.map((it) => (
                      <li key={it.id} className="flex justify-between text-gray-700">
                        <span>
                          {it.quantity > 1 && (
                            <span className="font-semibold mr-1">{it.quantity}×</span>
                          )}
                          {it.display_label || it.resolved_name}
                        </span>
                        <span className="text-gray-400 text-xs">
                          {formatRWF((it.unit_price ?? 0) * it.quantity)}
                        </span>
                      </li>
                    ))}
                  </ul>

                  <div className="border-t pt-2 space-y-0.5">
                    <div className="flex justify-between text-sm text-gray-500">
                      <span>A-la-carte</span>
                      <span className="line-through">{formatRWF(combo.a_la_carte_total)}</span>
                    </div>
                    <div className="flex justify-between font-bold text-orange-600">
                      <span>Combo price</span>
                      <span>{formatRWF(combo.combo_price)}</span>
                    </div>
                    {saving > 0 && (
                      <div className="text-right text-xs text-green-600 font-medium">
                        Save {formatRWF(saving)}
                      </div>
                    )}
                  </div>

                  <div className="flex gap-2 pt-1">
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1 gap-1"
                      onClick={() => openEdit(combo)}
                    >
                      <Edit className="h-3.5 w-3.5" /> Edit
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-red-500 hover:text-red-700 hover:border-red-300"
                      onClick={() => handleDelete(combo)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Create / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingCombo ? "Edit Combo" : "New Combo Package"}</DialogTitle>
            <DialogDescription>
              Pick presets and add-ons, set the bundle price, and save.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Basic fields */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Display Name *</Label>
                <Input
                  placeholder="Taco Meal Deal"
                  value={form.display_name}
                  onChange={(e) => {
                    const dn = e.target.value;
                    setForm((f) => ({
                      ...f,
                      display_name: dn,
                      name: f.name || slugify(dn),
                    }));
                  }}
                />
              </div>
              <div className="space-y-1">
                <Label>Internal Name (slug)</Label>
                <Input
                  placeholder="TACO_MEAL_DEAL"
                  value={form.name}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, name: e.target.value.toUpperCase() }))
                  }
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label>Description</Label>
              <Input
                placeholder="Wrap + Drink + Chips at a great price"
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              />
            </div>

            <div className="space-y-1">
              <Label>Image URL</Label>
              <Input
                placeholder="https://kblbites.com/images/combo-ultimate.jpg"
                value={form.image_url}
                onChange={(e) => setForm((f) => ({ ...f, image_url: e.target.value }))}
              />
              <p className="text-xs text-gray-500">
                Use a full URL or website path like /images/combo-ultimate.jpg.
              </p>
              {form.image_url.trim() && (
                <div className="mt-2 rounded-md border bg-gray-50 overflow-hidden">
                  <img
                    src={getImageUrl(form.image_url.trim())}
                    alt="Combo preview"
                    className="w-full h-40 object-cover"
                    onError={(e) => {
                      const target = e.currentTarget;
                      target.style.display = "none";
                    }}
                  />
                  <div className="px-2 py-1 text-[11px] text-gray-500 break-all">
                    {getImageUrl(form.image_url.trim())}
                  </div>
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Combo Price (RWF) *</Label>
                <Input
                  type="number"
                  min={0}
                  value={form.combo_price}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, combo_price: parseFloat(e.target.value) || 0 }))
                  }
                />
                {formALaCarteTotal > 0 && (
                  <p className="text-xs text-gray-500">
                    A-la-carte: {formatRWF(formALaCarteTotal)}
                    {savings > 0 && (
                      <span className="text-green-600 ml-1">→ save {formatRWF(savings)}</span>
                    )}
                  </p>
                )}
              </div>
              <div className="space-y-1">
                <Label>Sort Order</Label>
                <Input
                  type="number"
                  min={0}
                  value={form.sort_order}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, sort_order: parseInt(e.target.value) || 0 }))
                  }
                />
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Switch
                checked={form.available}
                onCheckedChange={(v) => setForm((f) => ({ ...f, available: v }))}
              />
              <Label>Available (visible to customers)</Label>
            </div>

            {/* Selected items */}
            <div className="space-y-2">
              <Label className="text-sm font-semibold">Combo Items</Label>
              {form.items.length === 0 ? (
                <p className="text-xs text-gray-400 py-2">No items yet — add from picker below.</p>
              ) : (
                <ul className="space-y-1.5">
                  {form.items.map((it, idx) => {
                    const name =
                      it.item_type === "preset"
                        ? presets.find((p) => p.id === it.item_id)?.display_name ?? `Preset #${it.item_id}`
                        : it.item_type === "drink"
                        ? drinks.find((d) => d.id === it.item_id)?.display_name ?? `Drink #${it.item_id}`
                        : ingredients.find((i) => i.id === it.item_id)?.display_name ?? `Ingredient #${it.item_id}`;
                    return (
                      <li
                        key={idx}
                        className="flex items-center gap-2 bg-gray-50 rounded px-2 py-1.5 text-sm"
                      >
                        <GripVertical className="h-3.5 w-3.5 text-gray-300 flex-shrink-0" />
                        <span className="flex-1 font-medium">{name}</span>
                        <Badge variant="outline" className="text-xs capitalize">
                          {it.item_type}
                        </Badge>
                        <div className="flex items-center gap-1">
                          <button
                            className="w-6 h-6 flex items-center justify-center rounded border text-gray-500 hover:bg-gray-200"
                            onClick={() => updateItemQty(idx, it.quantity - 1)}
                          >
                            –
                          </button>
                          <span className="w-5 text-center">{it.quantity}</span>
                          <button
                            className="w-6 h-6 flex items-center justify-center rounded border text-gray-500 hover:bg-gray-200"
                            onClick={() => updateItemQty(idx, it.quantity + 1)}
                          >
                            +
                          </button>
                        </div>
                        <button
                          className="text-red-400 hover:text-red-600"
                          onClick={() => removeItem(idx)}
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            {/* Item Picker */}
            <div className="border rounded-lg p-3 space-y-2 bg-gray-50">
              <div className="flex gap-2">
                <button
                  className={`text-xs px-3 py-1 rounded-full border transition-colors ${
                    pickerType === "preset"
                      ? "bg-orange-500 text-white border-orange-500"
                      : "bg-white text-gray-600 border-gray-300 hover:border-orange-300"
                  }`}
                  onClick={() => setPickerType("preset")}
                >
                  Presets (mains)
                </button>
                <button
                  className={`text-xs px-3 py-1 rounded-full border transition-colors ${
                    pickerType === "ingredient"
                      ? "bg-orange-500 text-white border-orange-500"
                      : "bg-white text-gray-600 border-gray-300 hover:border-orange-300"
                  }`}
                  onClick={() => setPickerType("ingredient")}
                >
                  Ingredients / Add-ons
                </button>
                <button
                  className={`text-xs px-3 py-1 rounded-full border transition-colors ${
                    pickerType === "drink"
                      ? "bg-orange-500 text-white border-orange-500"
                      : "bg-white text-gray-600 border-gray-300 hover:border-orange-300"
                  }`}
                  onClick={() => setPickerType("drink")}
                >
                  Drinks
                </button>
              </div>
              <Input
                placeholder={`Search ${pickerType}s…`}
                value={pickerSearch}
                onChange={(e) => setPickerSearch(e.target.value)}
                className="h-8 text-sm"
              />
              <div className="max-h-40 overflow-y-auto space-y-1">
                {filteredPickerItems.map((item) => {
                  const price =
                    pickerType === "preset"
                      ? ((item as Preset).preset_price ?? (item as Preset).product_base_price ?? 0)
                      : ((item as Ingredient | Drink).price ?? 0);
                  return (
                    <button
                      key={item.id}
                      className="w-full flex justify-between items-center text-sm px-2 py-1 rounded hover:bg-orange-50 hover:text-orange-700"
                      onClick={() => addItem(pickerType, item.id, item.display_name, price)}
                    >
                      <span>{item.display_name}</span>
                      <span className="text-xs text-gray-400">{formatRWF(price)}</span>
                    </button>
                  );
                })}
                {filteredPickerItems.length === 0 && (
                  <p className="text-xs text-gray-400 py-2 text-center">No matches</p>
                )}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving}
              className="bg-orange-500 hover:bg-orange-600 text-white"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              {editingCombo ? "Save Changes" : "Create Combo"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
