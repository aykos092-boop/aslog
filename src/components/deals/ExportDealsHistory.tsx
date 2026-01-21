import { useState } from "react";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { Download, FileSpreadsheet, FileText, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";

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

interface Stats {
  totalDeals: number;
  completedDeals: number;
  totalEarnings: number;
  averageRating: number | null;
}

interface ExportDealsHistoryProps {
  deals: Deal[];
  stats: Stats;
  currency?: "UZS" | "USD";
  exchangeRate?: number;
}

const statusLabels: Record<string, string> = {
  pending: "Kutilmoqda",
  accepted: "Qabul qilindi",
  in_transit: "Yo'lda",
  delivered: "Yetkazildi",
  cancelled: "Bekor qilindi",
};

export const ExportDealsHistory = ({ 
  deals, 
  stats, 
  currency = "UZS",
  exchangeRate = 12750 
}: ExportDealsHistoryProps) => {
  const { toast } = useToast();
  const [exporting, setExporting] = useState(false);

  const formatCurrency = (amount: number) => {
    if (currency === "USD") {
      return `$${(amount / exchangeRate).toFixed(2)}`;
    }
    return `${amount.toLocaleString("ru-RU")} so'm`;
  };

  const exportToExcel = () => {
    if (deals.length === 0) {
      toast({
        title: "Ma'lumot yo'q",
        description: "Eksport qilish uchun bitimlar yo'q",
        variant: "destructive",
      });
      return;
    }

    setExporting(true);

    try {
      // Create workbook
      const wb = XLSX.utils.book_new();

      // Stats sheet
      const statsData = [
        ["Statistika", "Qiymat"],
        ["Jami bitimlar", stats.totalDeals],
        ["Bajarilgan", stats.completedDeals],
        ["Jami daromad", formatCurrency(stats.totalEarnings)],
        ["O'rtacha reyting", stats.averageRating?.toFixed(1) || "—"],
        ["Eksport sanasi", format(new Date(), "dd.MM.yyyy HH:mm", { locale: ru })],
      ];
      const wsStats = XLSX.utils.aoa_to_sheet(statsData);
      XLSX.utils.book_append_sheet(wb, wsStats, "Statistika");

      // Deals sheet
      const dealsData = [
        ["ID", "Yuk turi", "Qayerdan", "Qayerga", "Narx", "Status", "Yaratilgan", "Tugallangan"],
        ...deals.map(deal => [
          deal.id.slice(0, 8),
          deal.order?.cargo_type || "",
          deal.order?.pickup_address || "",
          deal.order?.delivery_address || "",
          formatCurrency(deal.agreed_price),
          statusLabels[deal.status] || deal.status,
          format(new Date(deal.created_at), "dd.MM.yyyy", { locale: ru }),
          deal.completed_at ? format(new Date(deal.completed_at), "dd.MM.yyyy", { locale: ru }) : "—",
        ]),
      ];
      const wsDeals = XLSX.utils.aoa_to_sheet(dealsData);
      XLSX.utils.book_append_sheet(wb, wsDeals, "Bitimlar");

      // Download
      XLSX.writeFile(wb, `bitimlar_tarixi_${format(new Date(), "yyyy-MM-dd")}.xlsx`);

      toast({
        title: "Eksport yakunlandi",
        description: `${deals.length} ta bitim Excel formatida saqlandi`,
      });
    } catch (error) {
      toast({
        title: "Xato",
        description: "Eksport qilishda xatolik yuz berdi",
        variant: "destructive",
      });
    }

    setExporting(false);
  };

  const exportToPDF = () => {
    if (deals.length === 0) {
      toast({
        title: "Ma'lumot yo'q",
        description: "Eksport qilish uchun bitimlar yo'q",
        variant: "destructive",
      });
      return;
    }

    setExporting(true);

    try {
      const doc = new jsPDF();

      // Title
      doc.setFontSize(20);
      doc.text("Bitimlar tarixi", 14, 22);

      // Date
      doc.setFontSize(10);
      doc.text(`Sana: ${format(new Date(), "dd.MM.yyyy HH:mm")}`, 14, 30);

      // Stats summary
      doc.setFontSize(12);
      doc.text("Statistika:", 14, 45);
      doc.setFontSize(10);
      doc.text(`Jami bitimlar: ${stats.totalDeals}`, 14, 52);
      doc.text(`Bajarilgan: ${stats.completedDeals}`, 14, 58);
      doc.text(`Jami daromad: ${formatCurrency(stats.totalEarnings)}`, 14, 64);
      doc.text(`O'rtacha reyting: ${stats.averageRating?.toFixed(1) || "—"}`, 14, 70);

      // Deals table
      const tableData = deals.map(deal => [
        deal.id.slice(0, 8),
        deal.order?.cargo_type || "",
        (deal.order?.pickup_address || "").slice(0, 20),
        (deal.order?.delivery_address || "").slice(0, 20),
        formatCurrency(deal.agreed_price),
        statusLabels[deal.status] || deal.status,
        format(new Date(deal.created_at), "dd.MM.yy", { locale: ru }),
      ]);

      autoTable(doc, {
        startY: 80,
        head: [["ID", "Yuk", "Qayerdan", "Qayerga", "Narx", "Status", "Sana"]],
        body: tableData,
        styles: { fontSize: 8 },
        headStyles: { fillColor: [59, 130, 246] },
      });

      // Download
      doc.save(`bitimlar_tarixi_${format(new Date(), "yyyy-MM-dd")}.pdf`);

      toast({
        title: "Eksport yakunlandi",
        description: `${deals.length} ta bitim PDF formatida saqlandi`,
      });
    } catch (error) {
      toast({
        title: "Xato",
        description: "Eksport qilishda xatolik yuz berdi",
        variant: "destructive",
      });
    }

    setExporting(false);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" disabled={exporting}>
          {exporting ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <Download className="w-4 h-4 mr-2" />
          )}
          Eksport
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuItem onClick={exportToExcel}>
          <FileSpreadsheet className="w-4 h-4 mr-2 text-green-600" />
          Excel (.xlsx)
        </DropdownMenuItem>
        <DropdownMenuItem onClick={exportToPDF}>
          <FileText className="w-4 h-4 mr-2 text-red-600" />
          PDF
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
