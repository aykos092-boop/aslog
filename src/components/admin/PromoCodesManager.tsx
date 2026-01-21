import { useState, useEffect } from "react";
import { Plus, Pencil, Trash2, Tag, Users, Percent, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Label } from "@/components/ui/label";

interface PromoCode {
  id: string;
  code: string;
  description: string | null;
  discount_percent: number | null;
  discount_amount: number | null;
  min_order_weight: number | null;
  max_uses: number | null;
  current_uses: number;
  is_active: boolean;
  valid_until: string | null;
  created_at: string;
}

interface PromoFormData {
  code: string;
  description: string;
  discount_percent: string;
  discount_amount: string;
  min_order_weight: string;
  max_uses: string;
  is_active: boolean;
}

const initialFormData: PromoFormData = {
  code: "",
  description: "",
  discount_percent: "",
  discount_amount: "",
  min_order_weight: "0",
  max_uses: "",
  is_active: true,
};

export const PromoCodesManager = () => {
  const [promoCodes, setPromoCodes] = useState<PromoCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<PromoFormData>(initialFormData);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  // Fetch promo codes
  const fetchPromoCodes = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("promo_codes")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching promo codes:", error);
    } else {
      setPromoCodes(data || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchPromoCodes();
  }, []);

  const openCreateDialog = () => {
    setFormData(initialFormData);
    setEditingId(null);
    setDialogOpen(true);
  };

  const openEditDialog = (promo: PromoCode) => {
    setFormData({
      code: promo.code,
      description: promo.description || "",
      discount_percent: promo.discount_percent?.toString() || "",
      discount_amount: promo.discount_amount?.toString() || "",
      min_order_weight: promo.min_order_weight?.toString() || "0",
      max_uses: promo.max_uses?.toString() || "",
      is_active: promo.is_active,
    });
    setEditingId(promo.id);
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formData.code.trim()) {
      toast({ title: "Введите код промокода", variant: "destructive" });
      return;
    }

    if (!formData.discount_percent && !formData.discount_amount) {
      toast({ title: "Укажите скидку (% или сумму)", variant: "destructive" });
      return;
    }

    setSaving(true);

    const promoData = {
      code: formData.code.toUpperCase().trim(),
      description: formData.description || null,
      discount_percent: formData.discount_percent ? parseInt(formData.discount_percent) : null,
      discount_amount: formData.discount_amount ? parseFloat(formData.discount_amount) : null,
      min_order_weight: parseFloat(formData.min_order_weight) || 0,
      max_uses: formData.max_uses ? parseInt(formData.max_uses) : null,
      is_active: formData.is_active,
    };

    let error;
    if (editingId) {
      const result = await supabase
        .from("promo_codes")
        .update(promoData)
        .eq("id", editingId);
      error = result.error;
    } else {
      const result = await supabase.from("promo_codes").insert(promoData);
      error = result.error;
    }

    setSaving(false);

    if (error) {
      toast({
        title: "Ошибка сохранения",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({ title: editingId ? "Промокод обновлён" : "Промокод создан" });
      setDialogOpen(false);
      fetchPromoCodes();
    }
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("promo_codes").delete().eq("id", id);

    if (error) {
      toast({ title: "Ошибка удаления", variant: "destructive" });
    } else {
      toast({ title: "Промокод удалён" });
      fetchPromoCodes();
    }
  };

  const toggleActive = async (id: string, isActive: boolean) => {
    await supabase.from("promo_codes").update({ is_active: !isActive }).eq("id", id);
    fetchPromoCodes();
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Tag className="w-5 h-5" />
              Управление промокодами
            </CardTitle>
            <CardDescription>
              Создавайте и редактируйте промокоды для клиентов
            </CardDescription>
          </div>
          <Button onClick={openCreateDialog}>
            <Plus className="w-4 h-4 mr-2" />
            Новый промокод
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin" />
          </div>
        ) : promoCodes.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            Промокодов пока нет
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Код</TableHead>
                <TableHead>Скидка</TableHead>
                <TableHead>Использований</TableHead>
                <TableHead>Статус</TableHead>
                <TableHead className="text-right">Действия</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {promoCodes.map((promo) => (
                <TableRow key={promo.id}>
                  <TableCell>
                    <div>
                      <Badge variant="outline" className="font-mono">
                        {promo.code}
                      </Badge>
                      {promo.description && (
                        <p className="text-xs text-muted-foreground mt-1">
                          {promo.description}
                        </p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Percent className="w-3 h-3 text-muted-foreground" />
                      {promo.discount_percent
                        ? `${promo.discount_percent}%`
                        : `${promo.discount_amount?.toLocaleString()}₽`}
                    </div>
                    {promo.min_order_weight && promo.min_order_weight > 0 && (
                      <p className="text-xs text-muted-foreground">
                        от {promo.min_order_weight} кг
                      </p>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Users className="w-3 h-3 text-muted-foreground" />
                      {promo.current_uses}
                      {promo.max_uses && ` / ${promo.max_uses}`}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Switch
                      checked={promo.is_active}
                      onCheckedChange={() => toggleActive(promo.id, promo.is_active)}
                    />
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openEditDialog(promo)}
                      >
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(promo.id)}
                      >
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

        {/* Create/Edit Dialog */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editingId ? "Редактировать промокод" : "Новый промокод"}
              </DialogTitle>
              <DialogDescription>
                Заполните данные промокода
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Код промокода *</Label>
                <Input
                  value={formData.code}
                  onChange={(e) =>
                    setFormData({ ...formData, code: e.target.value.toUpperCase() })
                  }
                  placeholder="SALE20"
                  className="font-mono"
                />
              </div>

              <div className="space-y-2">
                <Label>Описание</Label>
                <Input
                  value={formData.description}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                  placeholder="Скидка для новых клиентов"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Скидка (%)</Label>
                  <Input
                    type="number"
                    value={formData.discount_percent}
                    onChange={(e) =>
                      setFormData({ ...formData, discount_percent: e.target.value })
                    }
                    placeholder="10"
                    min="0"
                    max="100"
                  />
                </div>
                <div className="space-y-2">
                  <Label>или сумма (₽)</Label>
                  <Input
                    type="number"
                    value={formData.discount_amount}
                    onChange={(e) =>
                      setFormData({ ...formData, discount_amount: e.target.value })
                    }
                    placeholder="500"
                    min="0"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Мин. вес груза (кг)</Label>
                  <Input
                    type="number"
                    value={formData.min_order_weight}
                    onChange={(e) =>
                      setFormData({ ...formData, min_order_weight: e.target.value })
                    }
                    placeholder="0"
                    min="0"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Макс. использований</Label>
                  <Input
                    type="number"
                    value={formData.max_uses}
                    onChange={(e) =>
                      setFormData({ ...formData, max_uses: e.target.value })
                    }
                    placeholder="Без ограничений"
                    min="1"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Switch
                  checked={formData.is_active}
                  onCheckedChange={(checked) =>
                    setFormData({ ...formData, is_active: checked })
                  }
                />
                <Label>Активен</Label>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                Отмена
              </Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {editingId ? "Сохранить" : "Создать"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
};
