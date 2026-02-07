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
import { useToast } from "@/hooks/use-toast";
import { Plus, Package, Loader2, Save } from "lucide-react";

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

export function AddonsManagement({ token }: AddonsManagementProps) {
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<number | null>(null);
  const [showAddonsOnly, setShowAddonsOnly] = useState(true);
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
    </div>
  );
}
