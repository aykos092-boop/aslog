import { useState, useEffect } from "react"
import { useLanguage } from "@/contexts/LanguageContext"
import { useFirebaseAuth } from "@/contexts/FirebaseAuthContext"
import { useToast } from "@/hooks/use-toast"
import { supabase } from "@/integrations/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import {
  FileText,
  Download,
  Eye,
  Plus,
  Search,
  Filter,
  Calendar,
  Building,
  Package,
  CheckCircle,
  Clock,
  AlertCircle,
  XCircle,
  Loader2
} from "lucide-react"

interface Document {
  id: string
  document_number: string
  document_type: string
  status: string
  title: string
  description?: string
  order_id?: string
  deal_id?: string
  warehouse_id?: string
  created_by: string
  approved_by?: string
  file_path?: string
  file_size?: number
  created_at: string
  updated_at: string
  approved_at?: string
  creator?: {
    email: string
    full_name?: string
  }
  approver?: {
    email: string
    full_name?: string
  }
  orders?: {
    id: string
    cargo_type: string
    pickup_address: string
    delivery_address: string
  }
  deals?: {
    id: string
    agreed_price: number
    status: string
  }
  warehouses?: {
    id: string
    name: string
    code: string
    address: string
  }
  document_items?: Array<{
    id: string
    product_name: string
    quantity: number
    unit_price?: number
    total_price?: number
  }>
}

const DocumentsManager = () => {
  const { t } = useLanguage()
  const { user } = useFirebaseAuth()
  const { toast } = useToast()

  const [documents, setDocuments] = useState<Document[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [filterType, setFilterType] = useState<string>("all")
  const [filterStatus, setFilterStatus] = useState<string>("all")
  const [selectedDocument, setSelectedDocument] = useState<Document | null>(null)
  const [isGeneratingPDF, setIsGeneratingPDF] = useState<string | null>(null)

  useEffect(() => {
    fetchDocuments()
  }, [])

  const fetchDocuments = async () => {
    try {
      setLoading(true)
      
      // Получаем документы без сложных JOIN
      const { data, error } = await supabase
        .from('documents')
        .select(`
          id,
          document_number,
          document_type,
          status,
          title,
          description,
          order_id,
          deal_id,
          warehouse_id,
          created_by,
          approved_by,
          file_path,
          file_size,
          created_at,
          updated_at,
          approved_at
        `)
        .order('created_at', { ascending: false })

      if (error) throw error
      
      // Получаем информацию о пользователях через profiles
      const userIds = data?.map(doc => doc.created_by).filter(Boolean)
      const approverIds = data?.map(doc => doc.approved_by).filter(Boolean)
      
      const allUserIds = [...new Set([...userIds, ...approverIds])]
      
      if (allUserIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, full_name, phone')
          .in('id', allUserIds)
        
        // Создаем мапу пользователей
        const userMap = profiles?.reduce((acc, profile) => {
          acc[profile.id] = {
            email: profile.phone || 'Unknown',
            full_name: profile.full_name || 'Unknown User'
          }
          return acc
        }, {})

        // Обогащаем данные документации информацией о пользователях
        const enrichedData = data?.map(doc => ({
          ...doc,
          creator: doc.created_by ? userMap[doc.created_by] : null,
          approver: doc.approved_by ? userMap[doc.approved_by] : null
        }))

        setDocuments(enrichedData || [])
      } else {
        setDocuments(data || [])
      }
    } catch (error) {
      console.error('Error fetching documents:', error)
      toast({
        title: t("common.error", "Error"),
        description: t("documents.fetchError", "Failed to fetch documents"),
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }

  const generatePDF = async (documentId: string) => {
    try {
      setIsGeneratingPDF(documentId)
      
      const { data, error } = await supabase.functions.invoke('documents-pdf', {
        body: { documentId }
      })

      if (error) throw error

      toast({
        title: t("documents.pdfGenerated", "PDF Generated"),
        description: t("documents.pdfGeneratedDesc", "Document PDF has been generated successfully"),
      })

      // Refresh documents to get updated file info
      fetchDocuments()
    } catch (error) {
      console.error('Error generating PDF:', error)
      toast({
        title: t("common.error", "Error"),
        description: t("documents.pdfError", "Failed to generate PDF"),
        variant: "destructive"
      })
    } finally {
      setIsGeneratingPDF(null)
    }
  }

  const downloadPDF = async (document: Document) => {
    if (!document.file_path) {
      toast({
        title: t("common.error", "Error"),
        description: t("documents.noFile", "No PDF file available"),
        variant: "destructive"
      })
      return
    }

    try {
      const { data, error } = await supabase.storage
        .from('documents')
        .download(document.file_path)

      if (error) throw error

      // Create download link
      const blob = new Blob([data], { type: 'application/pdf' })
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `${document.document_number}.pdf`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Error downloading PDF:', error)
      toast({
        title: t("common.error", "Error"),
        description: t("documents.downloadError", "Failed to download PDF"),
        variant: "destructive"
      })
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'draft': return <Clock className="w-4 h-4 text-gray-500" />
      case 'pending': return <AlertCircle className="w-4 h-4 text-yellow-500" />
      case 'approved': return <CheckCircle className="w-4 h-4 text-blue-500" />
      case 'final': return <CheckCircle className="w-4 h-4 text-green-500" />
      case 'cancelled': return <XCircle className="w-4 h-4 text-red-500" />
      default: return <FileText className="w-4 h-4" />
    }
  }

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      'draft': 'secondary',
      'pending': 'outline',
      'approved': 'default',
      'final': 'default',
      'cancelled': 'destructive'
    }

    return (
      <Badge variant={variants[status] || 'secondary'}>
        {t(`documents.status.${status}`, status)}
      </Badge>
    )
  }

  const getTypeLabel = (type: string) => {
    return t(`documents.type.${type}`, type)
  }

  const filteredDocuments = documents.filter(doc => {
    const matchesSearch = doc.document_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         doc.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         doc.description?.toLowerCase().includes(searchTerm.toLowerCase())

    const matchesType = filterType === 'all' || doc.document_type === filterType
    const matchesStatus = filterStatus === 'all' || doc.status === filterStatus

    return matchesSearch && matchesType && matchesStatus
  })

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="w-8 h-8 animate-spin" />
        <span className="ml-2">{t("common.loading", "Loading...")}</span>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">{t("documents.title", "Documents")}</h2>
          <p className="text-muted-foreground">
            {t("documents.subtitle", "Manage and generate documents")}
          </p>
        </div>
        <Button>
          <Plus className="w-4 h-4 mr-2" />
          {t("documents.create", "Create Document")}
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                <Input
                  placeholder={t("documents.searchPlaceholder", "Search documents...")}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder={t("documents.filterType", "Filter by type")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("documents.allTypes", "All Types")}</SelectItem>
                <SelectItem value="order_confirmation">{t("documents.type.order_confirmation", "Order Confirmation")}</SelectItem>
                <SelectItem value="shipping_manifest">{t("documents.type.shipping_manifest", "Shipping Manifest")}</SelectItem>
                <SelectItem value="receiving_report">{t("documents.type.receiving_report", "Receiving Report")}</SelectItem>
                <SelectItem value="inventory_report">{t("documents.type.inventory_report", "Inventory Report")}</SelectItem>
                <SelectItem value="warehouse_receipt">{t("documents.type.warehouse_receipt", "Warehouse Receipt")}</SelectItem>
                <SelectItem value="delivery_note">{t("documents.type.delivery_note", "Delivery Note")}</SelectItem>
                <SelectItem value="invoice">{t("documents.type.invoice", "Invoice")}</SelectItem>
                <SelectItem value="customs_declaration">{t("documents.type.customs_declaration", "Customs Declaration")}</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-full sm:w-[150px]">
                <SelectValue placeholder={t("documents.filterStatus", "Filter by status")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("documents.allStatuses", "All Statuses")}</SelectItem>
                <SelectItem value="draft">{t("documents.status.draft", "Draft")}</SelectItem>
                <SelectItem value="pending">{t("documents.status.pending", "Pending")}</SelectItem>
                <SelectItem value="approved">{t("documents.status.approved", "Approved")}</SelectItem>
                <SelectItem value="final">{t("documents.status.final", "Final")}</SelectItem>
                <SelectItem value="cancelled">{t("documents.status.cancelled", "Cancelled")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Documents Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5" />
            {t("documents.list", "Documents List")}
          </CardTitle>
          <CardDescription>
            {t("documents.listDesc", "Total documents: {{count}}", { count: filteredDocuments.length })}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("documents.number", "Number")}</TableHead>
                  <TableHead>{t("documents.type", "Type")}</TableHead>
                  <TableHead>{t("documents.title", "Title")}</TableHead>
                  <TableHead>{t("documents.status", "Status")}</TableHead>
                  <TableHead>{t("documents.created", "Created")}</TableHead>
                  <TableHead>{t("documents.actions", "Actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredDocuments.map((doc) => (
                  <TableRow key={doc.id}>
                    <TableCell className="font-mono text-sm">
                      {doc.document_number}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {getTypeLabel(doc.document_type)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div>
                        <div className="font-medium">{doc.title}</div>
                        {doc.description && (
                          <div className="text-sm text-muted-foreground truncate max-w-[200px]">
                            {doc.description}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {getStatusIcon(doc.status)}
                        {getStatusBadge(doc.status)}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        {new Date(doc.created_at).toLocaleDateString()}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setSelectedDocument(doc)}
                            >
                              <Eye className="w-4 h-4" />
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
                            <DialogHeader>
                              <DialogTitle>{doc.title}</DialogTitle>
                              <DialogDescription>
                                {doc.document_number} • {getTypeLabel(doc.document_type)}
                              </DialogDescription>
                            </DialogHeader>
                            {selectedDocument && (
                              <div className="space-y-6">
                                {/* Document Info */}
                                <div className="grid grid-cols-2 gap-4">
                                  <div>
                                    <Label>{t("documents.number", "Number")}</Label>
                                    <p className="font-mono">{selectedDocument.document_number}</p>
                                  </div>
                                  <div>
                                    <Label>{t("documents.type", "Type")}</Label>
                                    <p>{getTypeLabel(selectedDocument.document_type)}</p>
                                  </div>
                                  <div>
                                    <Label>{t("documents.status", "Status")}</Label>
                                    <div className="flex items-center gap-2 mt-1">
                                      {getStatusIcon(selectedDocument.status)}
                                      {getStatusBadge(selectedDocument.status)}
                                    </div>
                                  </div>
                                  <div>
                                    <Label>{t("documents.created", "Created")}</Label>
                                    <p>{new Date(selectedDocument.created_at).toLocaleString()}</p>
                                  </div>
                                </div>

                                {selectedDocument.description && (
                                  <div>
                                    <Label>{t("documents.description", "Description")}</Label>
                                    <p className="mt-1">{selectedDocument.description}</p>
                                  </div>
                                )}

                                {/* Related Information */}
                                {selectedDocument.orders && (
                                  <div>
                                    <Label className="flex items-center gap-2">
                                      <Package className="w-4 h-4" />
                                      {t("documents.orderInfo", "Order Information")}
                                    </Label>
                                    <div className="mt-2 p-3 border rounded-lg">
                                      <p><strong>{t("documents.cargo", "Cargo")}:</strong> {selectedDocument.orders.cargo_type}</p>
                                      <p><strong>{t("documents.from", "From")}:</strong> {selectedDocument.orders.pickup_address}</p>
                                      <p><strong>{t("documents.to", "To")}:</strong> {selectedDocument.orders.delivery_address}</p>
                                    </div>
                                  </div>
                                )}

                                {selectedDocument.warehouses && (
                                  <div>
                                    <Label className="flex items-center gap-2">
                                      <Building className="w-4 h-4" />
                                      {t("documents.warehouseInfo", "Warehouse Information")}
                                    </Label>
                                    <div className="mt-2 p-3 border rounded-lg">
                                      <p><strong>{t("documents.name", "Name")}:</strong> {selectedDocument.warehouses.name}</p>
                                      <p><strong>{t("documents.code", "Code")}:</strong> {selectedDocument.warehouses.code}</p>
                                      <p><strong>{t("documents.address", "Address")}:</strong> {selectedDocument.warehouses.address}</p>
                                    </div>
                                  </div>
                                )}

                                {/* Document Items */}
                                {selectedDocument.document_items && selectedDocument.document_items.length > 0 && (
                                  <div>
                                    <Label>{t("documents.items", "Items")}</Label>
                                    <div className="mt-2 border rounded-lg overflow-hidden">
                                      <Table>
                                        <TableHeader>
                                          <TableRow>
                                            <TableHead>{t("documents.product", "Product")}</TableHead>
                                            <TableHead>{t("documents.quantity", "Quantity")}</TableHead>
                                            <TableHead>{t("documents.price", "Price")}</TableHead>
                                            <TableHead>{t("documents.total", "Total")}</TableHead>
                                          </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                          {selectedDocument.document_items.map((item) => (
                                            <TableRow key={item.id}>
                                              <TableCell>{item.product_name}</TableCell>
                                              <TableCell>{item.quantity}</TableCell>
                                              <TableCell>{item.unit_price || '-'}</TableCell>
                                              <TableCell>{item.total_price || '-'}</TableCell>
                                            </TableRow>
                                          ))}
                                        </TableBody>
                                      </Table>
                                    </div>
                                  </div>
                                )}

                                {/* Signatures */}
                                <div className="grid grid-cols-2 gap-4">
                                  <div>
                                    <Label>{t("documents.createdBy", "Created By")}</Label>
                                    <p className="mt-1">
                                      {selectedDocument.creator?.full_name || selectedDocument.creator?.email || 'Unknown'}
                                    </p>
                                  </div>
                                  {selectedDocument.approver && (
                                    <div>
                                      <Label>{t("documents.approvedBy", "Approved By")}</Label>
                                      <p className="mt-1">
                                        {selectedDocument.approver.full_name || selectedDocument.approver.email || 'Unknown'}
                                      </p>
                                      {selectedDocument.approved_at && (
                                        <p className="text-sm text-muted-foreground">
                                          {new Date(selectedDocument.approved_at).toLocaleString()}
                                        </p>
                                      )}
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}
                          </DialogContent>
                        </Dialog>

                        {doc.file_path ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => downloadPDF(doc)}
                          >
                            <Download className="w-4 h-4" />
                          </Button>
                        ) : (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => generatePDF(doc.id)}
                            disabled={isGeneratingPDF === doc.id}
                          >
                            {isGeneratingPDF === doc.id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Download className="w-4 h-4" />
                            )}
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export { DocumentsManager }
