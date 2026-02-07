"use client";

import { useState, useEffect } from "react";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import { Plus, Package, Loader2 } from "lucide-react";

interface Ingredient {
  id: number;
  name: string;
  display_name: string;
  image_url?: string;
  category?: string;
  available: boolean;
  price?: number;
  available_as_addon?: boolean;
}

interface AddonsManagementProps {
  token: string | null;
}

const defaultCreateForm = {
  name: "",
  display_name: "",
  price: 0,
  available: true,
  available_as_addon: true,
  category: "",
  image_url: "",
};

export function AddonsManagement({ token }: AddonsManagementProps) {
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<number | null>(null);
  const [showAddonsOnly, setShowAddonsOnly] = useState(true);
  const [openCreateDialog, setOpenCreateDialog] = useState(false);
  const [createForm, setCreateForm] = useState(defaultCreateForm);
  const [creating, setCreating] = useState(false);
  const { toast } = useToast();

  const loadIngredients = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const q = showAddonsOnly ? "?addons_only=true" : "";
      const res = await fetch(`/api/ingredients${q}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setIngredients(Array.isArray(data) ? data : []);
      } else {
        toast({
          title: "Error",
          description: "Failed to load addons/ingredients",
          variant: "destructive",
        });
      }
    } catch (e) {
      toast({
        title: "Error",
        description: "Failed to load addons",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadIngredients();
  }, [token, showAddonsOnly]);

  const updateIngredient = async (
    id: number,
    updates: { available?: boolean; price?: number; available_as_addon?: boolean }
  ) => {
    if (!token) return;
    setSavingId(id);
    try {
      const res = await fetch(`/api/ingredients/${id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(updates),
      });
      if (res.ok) {
        const updated = await res.json();
        setIngredients((prev) =>
          prev.map((i) => (i.id === id ? { ...i, ...updated } : i))
        );
        toast({ title: "Saved", description: "Addon updated successfully." });
      } else {
        const err = await res.json().catch(() => ({}));
        toast({
          title: "Error",
          description: err.detail || err.error || "Failed to update",
          variant: "destructive",
        });
      }
    } catch (e) {
      toast({
        title: "Error",
        description: "Failed to update addon",
        variant: "destructive",
      });
    } finally {
      setSavingId(null);
    }
  };

  const toggleAvailable = (ing: Ingredient) => {
    updateIngredient(ing.id, { available: !ing.available });
  };

  const toggleAddon = (ing: Ingredient) => {
    updateIngredient(ing.id, { available_as_addon: !ing.available_as_addon });
  };

  const setPrice = (ing: Ingredient, value: string) => {
    const num = parseFloat(value);
    if (isNaN(num) || num < 0) return;
    updateIngredient(ing.id, { price: num });
  };

  const createIngredient = async () => {
    if (!token) return;
    const name = (createForm.name || "").trim();
    const display_name = (createForm.display_name || "").trim();
    if (!name || !display_name) {
      toast({
        title: "Validation",
        description: "Name and display name are required.",
        variant: "destructive",
      });
      return;
    }
    setCreating(true);
    try {
      const res = await fetch("/api/ingredients", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name,
          display_name,
          price: Number(createForm.price) || 0,
          available: createForm.available,
          available_as_addon: createForm.available_as_addon,
          category: createForm.category || undefined,
          image_url: createForm.image_url || undefined,
        }),
      });
      if (res.ok) {
        const created = await res.json();
        setIngredients((prev) => [...prev, created]);
        setOpenCreateDialog(false);
        setCreateForm(defaultCreateForm);
        toast({ title: "Created", description: "Addon created successfully." });
      } else {
        const err = await res.json().catch(() => ({}));
        toast({
          title: "Error",
          description: err.detail || err.error || "Failed to create addon",
          variant: "destructive",
        });
      }
    } catch (e) {
      toast({
        title: "Error",
        description: "Failed to create addon",
        variant: "destructive",
      });
    } finally {
      setCreating(false);
    }
  };

  if (!token) {
    return (
      <Card>
        <CardContent className="p-8 text-center text-muted-foreground">
          Sign in to manage addons.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Addons management
          </CardTitle>
          <CardDescription>
            Control which items are offered as add-ons and their prices. Toggle availability and add-on status; changes apply to web and mobile.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <Switch
                id="addons-only"
                checked={showAddonsOnly}
                onCheckedChange={setShowAddonsOnly}
              />
              <Label htmlFor="addons-only">Show addons only</Label>
            </div>
            <Button variant="outline" size="sm" onClick={loadIngredients}>
              Refresh
            </Button>
            <Button
              size="sm"
              onClick={() => {
                setCreateForm(defaultCreateForm);
                setOpenCreateDialog(true);
              }}
            >
              <Plus className="h-4 w-4 mr-2" />
              Create new addon
            </Button>
          </div>

          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : ingredients.length === 0 ? (
            <p className="text-center py-8 text-muted-foreground">
              {showAddonsOnly
                ? "No addons yet. Turn off “Show addons only” to see all ingredients and mark some as add-ons."
                : "No ingredients found."}
            </p>
          ) : (
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Price (RWF)</TableHead>
                    <TableHead>Available</TableHead>
                    <TableHead>Add-on</TableHead>
                    <TableHead className="w-[100px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(showAddonsOnly ? ingredients.filter((i) => i.available_as_addon) : ingredients).map((ing) => (
                    <TableRow key={ing.id}>
                      <TableCell className="font-medium">
                        {ing.display_name || ing.name}
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          min={0}
                          step={100}
                          value={ing.price ?? 0}
                          onChange={(e) => {
                            const v = e.target.value;
                            setIngredients((prev) =>
                              prev.map((i) =>
                                i.id === ing.id ? { ...i, price: parseFloat(v) || 0 } : i
                              )
                            );
                          }}
                          onBlur={(e) => setPrice(ing, e.target.value)}
                          className="w-24"
                          disabled={savingId === ing.id}
                        />
                      </TableCell>
                      <TableCell>
                        <Switch
                          checked={ing.available}
                          onCheckedChange={() => toggleAvailable(ing)}
                          disabled={savingId === ing.id}
                        />
                      </TableCell>
                      <TableCell>
                        <Switch
                          checked={!!ing.available_as_addon}
                          onCheckedChange={() => toggleAddon(ing)}
                          disabled={savingId === ing.id}
                        />
                        {ing.available_as_addon && (
                          <Badge variant="secondary" className="ml-2">Add-on</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {savingId === ing.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : null}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={openCreateDialog} onOpenChange={setOpenCreateDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create new addon</DialogTitle>
            <DialogDescription>
              Add a new ingredient that can be offered as an add-on. Name is used internally; display name is shown to customers.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="new-name">Name (internal)</Label>
              <Input
                id="new-name"
                placeholder="e.g. extra_cheese"
                value={createForm.name}
                onChange={(e) => setCreateForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="new-display-name">Display name</Label>
              <Input
                id="new-display-name"
                placeholder="e.g. Extra cheese"
                value={createForm.display_name}
                onChange={(e) => setCreateForm((f) => ({ ...f, display_name: e.target.value }))}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="new-price">Price (RWF)</Label>
              <Input
                id="new-price"
                type="number"
                min={0}
                step={100}
                value={createForm.price}
                placeholder="0"
                onChange={(e) =>
                  setCreateForm((f) => ({ ...f, price: parseFloat(e.target.value) || 0 }))
                }
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="new-category">Category (optional)</Label>
              <Input
                id="new-category"
                placeholder="e.g. toppings"
                value={createForm.category}
                onChange={(e) => setCreateForm((f) => ({ ...f, category: e.target.value }))}
              />
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Switch
                  id="new-available"
                  checked={createForm.available}
                  onCheckedChange={(c) => setCreateForm((f) => ({ ...f, available: c }))}
                />
                <Label htmlFor="new-available">Available</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  id="new-addon"
                  checked={createForm.available_as_addon}
                  onCheckedChange={(c) => setCreateForm((f) => ({ ...f, available_as_addon: c }))}
                />
                <Label htmlFor="new-addon">Offer as add-on</Label>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenCreateDialog(false)} disabled={creating}>
              Cancel
            </Button>
            <Button onClick={createIngredient} disabled={creating}>
              {creating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Creating…
                </>
              ) : (
                "Create addon"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
