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
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Settings, Save, Loader2 } from "lucide-react";

interface AppConfig {
  orders_enabled: boolean;
  website_orders_enabled?: boolean;
  mobile_orders_enabled?: boolean;
  maintenance_message: string;
  special_announcement_enabled: boolean;
  special_announcement: string;
  promo: {
    enabled: boolean;
    discount: number;
    excluded_products: string;
    start_hour: number;
    end_hour: number;
    day: number;
  };
}

export function AppConfigManagement() {
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem("kitchen_token");
      const response = await fetch("/api/config/app", {
        headers: token ? {
          Authorization: `Bearer ${token}`,
        } : {},
      });
      if (response.ok) {
        const data = await response.json();
        setConfig({
          ...data,
          website_orders_enabled: data.website_orders_enabled ?? data.orders_enabled ?? true,
          mobile_orders_enabled: data.mobile_orders_enabled ?? data.orders_enabled ?? true,
        });
      } else {
        throw new Error("Failed to load config");
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load app configuration",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const saveConfig = async () => {
    if (!config) return;

    try {
      setSaving(true);
      const token = localStorage.getItem("kitchen_token");
      if (!token) {
        toast({
          title: "Error",
          description: "Authentication required",
          variant: "destructive",
        });
        return;
      }
      const response = await fetch("/api/config/app", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(config),
      });

      if (response.ok) {
        toast({
          title: "Success",
          description: "App configuration updated successfully",
        });
      } else {
        const error = await response.json();
        throw new Error(error.detail || "Failed to update config");
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to update app configuration",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center p-8">
          <Loader2 className="h-6 w-6 animate-spin" />
        </CardContent>
      </Card>
    );
  }

  if (!config) {
    return (
      <Card>
        <CardContent className="p-8">
          <p className="text-center text-muted-foreground">
            Failed to load configuration
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            App Configuration
          </CardTitle>
          <CardDescription>
            Disable website or mobile ordering and set the message users see. Use to avoid orders that would be refunded or cause frustration.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Order source availability */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold border-b pb-2">Order source availability</h3>
            <p className="text-sm text-muted-foreground">
              Control which channels can accept orders (website, mobile). When a source is off, users see the maintenance message.
            </p>
          </div>
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="website-orders">Website orders enabled</Label>
              <p className="text-sm text-muted-foreground">
                Allow orders from the website (kblbites.com). When off, users see the maintenance message and cannot order.
              </p>
            </div>
            <Switch
              id="website-orders"
              checked={config.website_orders_enabled ?? config.orders_enabled ?? true}
              onCheckedChange={(checked) =>
                setConfig({ ...config, website_orders_enabled: checked })
              }
            />
          </div>

          {/* Mobile orders */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="mobile-orders">Mobile app orders enabled</Label>
              <p className="text-sm text-muted-foreground">
                Allow orders from the mobile app. When off, users see the maintenance message and cannot place orders.
              </p>
            </div>
            <Switch
              id="mobile-orders"
              checked={config.mobile_orders_enabled ?? config.orders_enabled ?? true}
              onCheckedChange={(checked) =>
                setConfig({ ...config, mobile_orders_enabled: checked })
              }
            />
          </div>

          <div className="flex items-center justify-between border-t pt-4">
            <div className="space-y-0.5">
              <Label htmlFor="orders-enabled">Master: all orders enabled</Label>
              <p className="text-sm text-muted-foreground">
                When off, both website and mobile are disabled (overrides the two toggles above).
              </p>
            </div>
            <Switch
              id="orders-enabled"
              checked={config.orders_enabled}
              onCheckedChange={(checked) =>
                setConfig({ ...config, orders_enabled: checked })
              }
            />
          </div>

          {/* Site config */}
          <div className="space-y-4 border-t pt-6 mt-4">
            <h3 className="text-lg font-semibold border-b pb-2">Site config</h3>
            <p className="text-sm text-muted-foreground">
              Maintenance message, announcements, and promo settings shown to customers.
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="maintenance-message">Maintenance Message</Label>
            <Textarea
              id="maintenance-message"
              value={config.maintenance_message}
              onChange={(e) =>
                setConfig({ ...config, maintenance_message: e.target.value })
              }
              placeholder="Message to show when orders are disabled"
              rows={3}
            />
          </div>

          {/* Special Announcement */}
          <div className="space-y-4 border-t pt-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="announcement-enabled">Special Announcement</Label>
                <p className="text-sm text-muted-foreground">
                  Show a special announcement banner
                </p>
              </div>
              <Switch
                id="announcement-enabled"
                checked={config.special_announcement_enabled}
                onCheckedChange={(checked) =>
                  setConfig({
                    ...config,
                    special_announcement_enabled: checked,
                  })
                }
              />
            </div>
            {config.special_announcement_enabled && (
              <div className="space-y-2">
                <Label htmlFor="announcement-text">Announcement Text</Label>
                <Textarea
                  id="announcement-text"
                  value={config.special_announcement}
                  onChange={(e) =>
                    setConfig({ ...config, special_announcement: e.target.value })
                  }
                  placeholder="Announcement message"
                  rows={3}
                />
              </div>
            )}
          </div>

          {/* Promo Settings */}
          <div className="space-y-4 border-t pt-4">
            <h3 className="text-lg font-semibold">Promo Settings</h3>
            
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="promo-enabled">Promo Enabled</Label>
                <p className="text-sm text-muted-foreground">
                  Enable Friday special promo
                </p>
              </div>
              <Switch
                id="promo-enabled"
                checked={config.promo.enabled}
                onCheckedChange={(checked) =>
                  setConfig({
                    ...config,
                    promo: { ...config.promo, enabled: checked },
                  })
                }
              />
            </div>

            {config.promo.enabled && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="promo-discount">Discount (RWF)</Label>
                  <Input
                    id="promo-discount"
                    type="number"
                    value={config.promo.discount}
                    onChange={(e) =>
                      setConfig({
                        ...config,
                        promo: {
                          ...config.promo,
                          discount: parseInt(e.target.value) || 0,
                        },
                      })
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="promo-day">Day of Week</Label>
                  <Input
                    id="promo-day"
                    type="number"
                    min="0"
                    max="6"
                    value={config.promo.day}
                    onChange={(e) =>
                      setConfig({
                        ...config,
                        promo: {
                          ...config.promo,
                          day: parseInt(e.target.value) || 5,
                        },
                      })
                    }
                  />
                  <p className="text-xs text-muted-foreground">
                    0=Sunday, 5=Friday
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="promo-start-hour">Start Hour</Label>
                  <Input
                    id="promo-start-hour"
                    type="number"
                    min="0"
                    max="23"
                    value={config.promo.start_hour}
                    onChange={(e) =>
                      setConfig({
                        ...config,
                        promo: {
                          ...config.promo,
                          start_hour: parseInt(e.target.value) || 10,
                        },
                      })
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="promo-end-hour">End Hour</Label>
                  <Input
                    id="promo-end-hour"
                    type="number"
                    min="0"
                    max="23"
                    value={config.promo.end_hour}
                    onChange={(e) =>
                      setConfig({
                        ...config,
                        promo: {
                          ...config.promo,
                          end_hour: parseInt(e.target.value) || 14,
                        },
                      })
                    }
                  />
                </div>

                <div className="space-y-2 col-span-2">
                  <Label htmlFor="promo-excluded">Excluded Products</Label>
                  <Input
                    id="promo-excluded"
                    value={config.promo.excluded_products}
                    onChange={(e) =>
                      setConfig({
                        ...config,
                        promo: {
                          ...config.promo,
                          excluded_products: e.target.value,
                        },
                      })
                    }
                    placeholder="Comma-separated: Wrap,Large"
                  />
                  <p className="text-xs text-muted-foreground">
                    Products excluded from promo (comma-separated)
                  </p>
                </div>
              </div>
            )}
          </div>

          <div className="flex justify-end pt-4 border-t">
            <Button onClick={saveConfig} disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  Save Configuration
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
