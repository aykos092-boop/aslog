import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/contexts/LanguageContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { 
  Search, 
  Loader2, 
  Clock, 
  Eye,
  CheckCircle,
  XCircle,
  AlertCircle,
  FileText,
  Camera,
  User
} from "lucide-react";
import { format } from "date-fns";

interface KYCDocument {
  id: string;
  user_id: string;
  passport_front_url: string | null;
  passport_back_url: string | null;
  selfie_url: string | null;
  video_selfie_url: string | null;
  extracted_data: any;
  face_match_score: number | null;
  liveness_score: number | null;
  document_authenticity_score: number | null;
  status: 'not_started' | 'pending' | 'verified' | 'rejected' | 'manual_review';
  rejection_reason: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
  profile?: {
    full_name: string | null;
    phone: string | null;
  };
}

const statusConfig = {
  not_started: { label: "Not Started", icon: Clock, color: "bg-gray-100 text-gray-700" },
  pending: { label: "Pending Review", icon: AlertCircle, color: "bg-yellow-100 text-yellow-700" },
  verified: { label: "Verified", icon: CheckCircle, color: "bg-green-100 text-green-700" },
  rejected: { label: "Rejected", icon: XCircle, color: "bg-red-100 text-red-700" },
  manual_review: { label: "Manual Review", icon: Eye, color: "bg-blue-100 text-blue-700" },
};

export const KYCDashboard = () => {
  const { t } = useLanguage();
  const { toast } = useToast();
  const [documents, setDocuments] = useState<KYCDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedDoc, setSelectedDoc] = useState<KYCDocument | null>(null);

  const fetchDocuments = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("kyc_documents")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching KYC documents:", error);
      setLoading(false);
      return;
    }

    // Fetch profiles for each document
    const userIds = data?.map(d => d.user_id) || [];
    const { data: profiles } = await supabase
      .from("profiles")
      .select("user_id, full_name, phone")
      .in("user_id", userIds);

    const profileMap = new Map(profiles?.map(p => [p.user_id, p]));
    const enrichedDocs = data?.map(doc => ({
      ...doc,
      profile: profileMap.get(doc.user_id)
    })) || [];

    setDocuments(enrichedDocs);
    setLoading(false);
  };

  useEffect(() => {
    fetchDocuments();
  }, []);

  const handleStatusUpdate = async (docId: string, newStatus: KYCDocument['status'], reason?: string) => {
    const { error } = await supabase
      .from("kyc_documents")
      .update({
        status: newStatus,
        rejection_reason: reason || null,
        reviewed_at: new Date().toISOString()
      })
      .eq("id", docId);

    if (error) {
      toast({
        title: "Error",
        description: "Failed to update KYC status",
        variant: "destructive"
      });
      return;
    }

    toast({
      title: "Success",
      description: `KYC status updated to ${statusConfig[newStatus].label}`,
    });

    fetchDocuments();
    setSelectedDoc(null);
  };

  const filteredDocuments = documents.filter(doc => {
    const matchesSearch = doc.profile?.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          doc.profile?.phone?.includes(searchQuery);
    const matchesStatus = statusFilter === "all" || doc.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const stats = {
    total: documents.length,
    pending: documents.filter(d => d.status === 'pending').length,
    verified: documents.filter(d => d.status === 'verified').length,
    rejected: documents.filter(d => d.status === 'rejected').length,
    manual_review: documents.filter(d => d.status === 'manual_review').length,
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="py-10">
          <div className="flex items-center justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold">{stats.total}</div>
            <div className="text-sm text-muted-foreground">Total</div>
          </CardContent>
        </Card>
        <Card className="border-yellow-200 bg-yellow-50/50">
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-yellow-700">{stats.pending}</div>
            <div className="text-sm text-yellow-600">Pending</div>
          </CardContent>
        </Card>
        <Card className="border-green-200 bg-green-50/50">
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-green-700">{stats.verified}</div>
            <div className="text-sm text-green-600">Verified</div>
          </CardContent>
        </Card>
        <Card className="border-red-200 bg-red-50/50">
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-red-700">{stats.rejected}</div>
            <div className="text-sm text-red-600">Rejected</div>
          </CardContent>
        </Card>
        <Card className="border-blue-200 bg-blue-50/50">
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-blue-700">{stats.manual_review}</div>
            <div className="text-sm text-blue-600">Manual Review</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5" />
            KYC Documents
          </CardTitle>
          <CardDescription>Review and manage user verification documents</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search by name or phone..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="verified">Verified</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
                <SelectItem value="manual_review">Manual Review</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="rounded-lg border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead>User</TableHead>
                  <TableHead>Documents</TableHead>
                  <TableHead>Scores</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Submitted</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredDocuments.map((doc) => {
                  const StatusIcon = statusConfig[doc.status].icon;
                  return (
                    <TableRow key={doc.id} className="hover:bg-muted/30">
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center">
                            <User className="w-4 h-4 text-primary" />
                          </div>
                          <div>
                            <div className="font-medium">{doc.profile?.full_name || "Unknown"}</div>
                            <div className="text-sm text-muted-foreground">{doc.profile?.phone || "No phone"}</div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          {doc.passport_front_url && <Badge variant="outline" className="text-xs">Passport</Badge>}
                          {doc.selfie_url && <Badge variant="outline" className="text-xs">Selfie</Badge>}
                          {doc.video_selfie_url && <Badge variant="outline" className="text-xs">Video</Badge>}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-xs space-y-1">
                          {doc.face_match_score !== null && (
                            <div>Face: {(doc.face_match_score * 100).toFixed(0)}%</div>
                          )}
                          {doc.liveness_score !== null && (
                            <div>Liveness: {(doc.liveness_score * 100).toFixed(0)}%</div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={statusConfig[doc.status].color}>
                          <StatusIcon className="w-3 h-3 mr-1" />
                          {statusConfig[doc.status].label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {format(new Date(doc.created_at), "dd.MM.yyyy")}
                      </TableCell>
                      <TableCell className="text-right">
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button variant="ghost" size="sm" onClick={() => setSelectedDoc(doc)}>
                              <Eye className="w-4 h-4 mr-1" />
                              Review
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="max-w-2xl">
                            <DialogHeader>
                              <DialogTitle>KYC Review - {doc.profile?.full_name}</DialogTitle>
                              <DialogDescription>Review verification documents and update status</DialogDescription>
                            </DialogHeader>
                            <div className="grid grid-cols-2 gap-4 py-4">
                              {doc.passport_front_url && (
                                <div className="space-y-2">
                                  <div className="text-sm font-medium">Passport Front</div>
                                  <img src={doc.passport_front_url} alt="Passport Front" className="rounded-lg border" />
                                </div>
                              )}
                              {doc.passport_back_url && (
                                <div className="space-y-2">
                                  <div className="text-sm font-medium">Passport Back</div>
                                  <img src={doc.passport_back_url} alt="Passport Back" className="rounded-lg border" />
                                </div>
                              )}
                              {doc.selfie_url && (
                                <div className="space-y-2">
                                  <div className="text-sm font-medium">Selfie</div>
                                  <img src={doc.selfie_url} alt="Selfie" className="rounded-lg border" />
                                </div>
                              )}
                            </div>
                            <div className="flex gap-2 justify-end">
                              <Button
                                variant="outline"
                                onClick={() => handleStatusUpdate(doc.id, 'rejected', 'Documents unclear or invalid')}
                              >
                                <XCircle className="w-4 h-4 mr-1" />
                                Reject
                              </Button>
                              <Button
                                variant="outline"
                                onClick={() => handleStatusUpdate(doc.id, 'manual_review')}
                              >
                                <AlertCircle className="w-4 h-4 mr-1" />
                                Manual Review
                              </Button>
                              <Button
                                onClick={() => handleStatusUpdate(doc.id, 'verified')}
                              >
                                <CheckCircle className="w-4 h-4 mr-1" />
                                Approve
                              </Button>
                            </div>
                          </DialogContent>
                        </Dialog>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {filteredDocuments.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      No KYC documents found
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
