import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { Download, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

interface Deal {
  id: string;
  agreed_price: number;
  status: string;
  created_at: string;
  completed_at?: string | null;
  order?: {
    cargo_type: string;
    pickup_address: string;
    delivery_address: string;
  };
  other_profile?: {
    full_name: string | null;
  };
}

interface ExportDealsButtonProps {
  deals: Deal[];
  role: "client" | "carrier";
}

export const ExportDealsButton = ({ deals, role }: ExportDealsButtonProps) => {
  const { toast } = useToast();

  const statusLabels: Record<string, string> = {
    pending: "Ожидает",
    accepted: "Принята",
    in_transit: "В пути",
    delivered: "Доставлено",
    cancelled: "Отменена",
  };

  const exportToCSV = () => {
    if (deals.length === 0) {
      toast({
        title: "Нет данных",
        description: "Нет сделок для экспорта",
        variant: "destructive",
      });
      return;
    }

    // Create CSV headers
    const headers = [
      "ID",
      "Тип груза",
      "Откуда",
      "Куда",
      role === "client" ? "Перевозчик" : "Клиент",
      "Цена (₽)",
      "Статус",
      "Дата создания",
      "Дата завершения",
    ];

    // Create CSV rows
    const rows = deals.map((deal) => [
      deal.id,
      deal.order?.cargo_type || "",
      deal.order?.pickup_address || "",
      deal.order?.delivery_address || "",
      deal.other_profile?.full_name || "—",
      deal.agreed_price.toString(),
      statusLabels[deal.status] || deal.status,
      format(new Date(deal.created_at), "dd.MM.yyyy HH:mm", { locale: ru }),
      deal.completed_at
        ? format(new Date(deal.completed_at), "dd.MM.yyyy HH:mm", { locale: ru })
        : "—",
    ]);

    // Combine headers and rows
    const csvContent = [
      headers.join(";"),
      ...rows.map((row) => row.map((cell) => `"${cell}"`).join(";")),
    ].join("\n");

    // Add BOM for Excel UTF-8 support
    const BOM = "\uFEFF";
    const blob = new Blob([BOM + csvContent], { type: "text/csv;charset=utf-8;" });

    // Create download link
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `deals_${format(new Date(), "yyyy-MM-dd")}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast({
      title: "Экспорт завершён",
      description: `Экспортировано ${deals.length} сделок`,
    });
  };

  return (
    <Button variant="outline" size="sm" onClick={exportToCSV}>
      <Download className="w-4 h-4 mr-2" />
      Экспорт CSV
    </Button>
  );
};
