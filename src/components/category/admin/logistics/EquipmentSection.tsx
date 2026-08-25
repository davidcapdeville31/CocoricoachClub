import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Plus, Package, Search, AlertTriangle, Trash2, Edit2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import i18n from "@/i18n";

interface EquipmentSectionProps {
  categoryId: string;
}

interface Equipment {
  id: string;
  name: string;
  category: string;
  quantity: number;
  available_quantity: number;
  condition: string;
  location: string | null;
  notes: string | null;
  last_maintenance: string | null;
}

const getEquipmentCategories = () => [
  { value: "balls", label: i18n.t("adminRecruitDocs.logistics.equipment.categories.balls") },
  { value: "cones", label: i18n.t("adminRecruitDocs.logistics.equipment.categories.cones") },
  { value: "goals", label: i18n.t("adminRecruitDocs.logistics.equipment.categories.goals") },
  { value: "bibs", label: i18n.t("adminRecruitDocs.logistics.equipment.categories.bibs") },
  { value: "gym", label: i18n.t("adminRecruitDocs.logistics.equipment.categories.gym") },
  { value: "medical", label: i18n.t("adminRecruitDocs.logistics.equipment.categories.medical") },
  { value: "gps", label: i18n.t("adminRecruitDocs.logistics.equipment.categories.gps") },
  { value: "video", label: i18n.t("adminRecruitDocs.logistics.equipment.categories.video") },
  { value: "clothing", label: i18n.t("adminRecruitDocs.logistics.equipment.categories.clothing") },
  { value: "other", label: i18n.t("adminRecruitDocs.logistics.equipment.categories.other") },
];

const CONDITION_COLORS: Record<string, string> = {
  excellent: "bg-green-100 text-green-700",
  good: "bg-blue-100 text-blue-700",
  fair: "bg-amber-100 text-amber-700",
  poor: "bg-red-100 text-red-700",
};

const getConditionLabels = (): Record<string, string> => ({
  excellent: i18n.t("adminRecruitDocs.logistics.equipment.conditionLabels.excellent"),
  good: i18n.t("adminRecruitDocs.logistics.equipment.conditionLabels.good"),
  fair: i18n.t("adminRecruitDocs.logistics.equipment.conditionLabels.fair"),
  poor: i18n.t("adminRecruitDocs.logistics.equipment.conditionLabels.poor"),
});

export function EquipmentSection({ categoryId }: EquipmentSectionProps) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");

  const [formData, setFormData] = useState({
    name: "",
    category: "balls",
    quantity: "1",
    condition: "good",
    location: "",
    notes: "",
  });

  const { data: equipment, isLoading } = useQuery({
    queryKey: ["equipment", categoryId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("equipment_inventory" as any)
        .select("*")
        .eq("category_id", categoryId)
        .order("category")
        .order("name");
      if (error) throw error;
      return data as unknown as Equipment[];
    },
  });

  const addEquipmentMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const qty = parseInt(data.quantity);
      const { error } = await supabase.from("equipment_inventory" as any).insert({
        category_id: categoryId,
        name: data.name,
        category: data.category,
        quantity: qty,
        available_quantity: qty,
        condition: data.condition,
        location: data.location || null,
        notes: data.notes || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["equipment", categoryId] });
      setShowAddDialog(false);
      setFormData({ name: "", category: "balls", quantity: "1", condition: "good", location: "", notes: "" });
      toast({ title: t("adminRecruitDocs.logistics.equipment.toasts.equipmentAdded") });
    },
  });

  const updateQuantityMutation = useMutation({
    mutationFn: async ({ id, available }: { id: string; available: number }) => {
      const { error } = await supabase
        .from("equipment_inventory" as any)
        .update({ available_quantity: available })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["equipment", categoryId] });
    },
  });

  const deleteEquipmentMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("equipment_inventory" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["equipment", categoryId] });
      toast({ title: t("adminRecruitDocs.logistics.equipment.toasts.equipmentDeleted") });
    },
  });

  const filteredEquipment = equipment?.filter((item) => {
    const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = categoryFilter === "all" || item.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  const lowStockItems = equipment?.filter((e) => e.available_quantity < e.quantity * 0.3) || [];

  return (
    <div className="space-y-6">
      {/* Alertes stock bas */}
      {lowStockItems.length > 0 && (
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-amber-700 font-medium mb-2">
              <AlertTriangle className="h-4 w-4" />
              {t("adminRecruitDocs.logistics.equipment.lowStock", { count: lowStockItems.length })}
            </div>
            <div className="text-sm text-amber-600">
              {lowStockItems.map((item) => (
                <span key={item.id} className="mr-3">
                  {t("adminRecruitDocs.logistics.equipment.stockRatio", { name: item.name, available: item.available_quantity, quantity: item.quantity })}
                </span>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="flex flex-1 gap-2 w-full sm:w-auto">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={t("adminRecruitDocs.logistics.equipment.searchPlaceholder")}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder={t("adminRecruitDocs.logistics.equipment.categoryPlaceholder")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("adminRecruitDocs.logistics.equipment.allCategories")}</SelectItem>
              {getEquipmentCategories().map((cat) => (
                <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              {t("adminRecruitDocs.logistics.equipment.add")}
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t("adminRecruitDocs.logistics.equipment.newEquipment")}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>{t("adminRecruitDocs.logistics.equipment.name")}</Label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder={t("adminRecruitDocs.logistics.equipment.namePlaceholder")}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>{t("adminRecruitDocs.logistics.equipment.category")}</Label>
                  <Select value={formData.category} onValueChange={(v) => setFormData({ ...formData, category: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {getEquipmentCategories().map((cat) => (
                        <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>{t("adminRecruitDocs.logistics.equipment.quantity")}</Label>
                  <Input
                    type="number"
                    min="1"
                    value={formData.quantity}
                    onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>{t("adminRecruitDocs.logistics.equipment.condition")}</Label>
                  <Select value={formData.condition} onValueChange={(v) => setFormData({ ...formData, condition: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(getConditionLabels()).map(([key, label]) => (
                        <SelectItem key={key} value={key}>{label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>{t("adminRecruitDocs.logistics.equipment.location")}</Label>
                  <Input
                    value={formData.location}
                    onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                    placeholder={t("adminRecruitDocs.logistics.equipment.locationPlaceholder")}
                  />
                </div>
              </div>
              <div>
                <Label>{t("adminRecruitDocs.logistics.equipment.notes")}</Label>
                <Textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder={t("adminRecruitDocs.logistics.equipment.notesPlaceholder")}
                  rows={2}
                />
              </div>
              <Button onClick={() => addEquipmentMutation.mutate(formData)} disabled={!formData.name} className="w-full">
                {t("adminRecruitDocs.logistics.equipment.add")}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Liste des équipements */}
      {isLoading ? (
        <div className="text-center py-8 text-muted-foreground">{t("adminRecruitDocs.logistics.equipment.loading")}</div>
      ) : filteredEquipment?.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            <Package className="h-12 w-12 mx-auto mb-4 opacity-30" />
            <p>{t("adminRecruitDocs.logistics.equipment.noEquipment")}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filteredEquipment?.map((item) => (
            <Card key={item.id}>
              <CardContent className="p-4">
                <div className="flex justify-between items-start mb-3">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center">
                      <Package className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div>
                      <h4 className="font-medium">{item.name}</h4>
                      <p className="text-xs text-muted-foreground">
                        {getEquipmentCategories().find((c) => c.value === item.category)?.label}
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive"
                    onClick={() => deleteEquipmentMutation.mutate(item.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge className={CONDITION_COLORS[item.condition]}>
                      {getConditionLabels()[item.condition]}
                    </Badge>
                    {item.location && (
                      <span className="text-xs text-muted-foreground">{item.location}</span>
                    )}
                  </div>
                </div>

                <div className="mt-3 flex items-center justify-between">
                  <span className="text-sm">
                    {t("adminRecruitDocs.logistics.equipment.available", { available: item.available_quantity, quantity: item.quantity })}
                  </span>
                  <div className="flex gap-1">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={item.available_quantity <= 0}
                      onClick={() => updateQuantityMutation.mutate({ id: item.id, available: item.available_quantity - 1 })}
                    >
                      -
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={item.available_quantity >= item.quantity}
                      onClick={() => updateQuantityMutation.mutate({ id: item.id, available: item.available_quantity + 1 })}
                    >
                      +
                    </Button>
                  </div>
                </div>

                {/* Barre de progression */}
                <div className="mt-2 h-1.5 bg-muted rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${
                      item.available_quantity < item.quantity * 0.3 ? "bg-red-500" :
                      item.available_quantity < item.quantity * 0.6 ? "bg-amber-500" : "bg-green-500"
                    }`}
                    style={{ width: `${(item.available_quantity / item.quantity) * 100}%` }}
                  />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
