import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { 
  Search, 
  Loader2, 
  Clock,
  Eye,
  CheckCircle,
  XCircle,
  AlertCircle,
  Building,
  User,
  Mail,
  RotateCcw
} from "lucide-react";
import { format } from "date-fns";

interface RegistrationRequest {
  id: string;
  user_id: string;
  company_name: string | null;
  business_type: string | null;
  country: string | null;
  terms_accepted: boolean;
  privacy_accepted: boolean;
  email_verified: boolean;
  status: 'pending' | 'approved' | 'rejected' | 'resubmission_required';
  rejection_reason: string | null;
  onboarding_step: number;
  created_at: string;
  profile?: {
    full_name: string | null;
    phone: string | null;
  };
  email?: string;
}

const statusConfig = {
  pending: { label: "Pending", icon: Clock, color: "bg-yellow-100 text-yellow-700" },
  approved: { label: "Approved", icon: CheckCircle, color: "bg-green-100 text-green-700" },
  rejected: { label: "Rejected", icon: XCircle, color: "bg-red-100 text-red-700" },
  resubmission_required: { label: "Resubmit", icon: RotateCcw, color: "bg-orange-100 text-orange-700" },
};

export const RegistrationRequestsTable = () => {
  const { t } = useLanguage();
  const { toast } = useToast();
  const [requests, setRequests] = useState<RegistrationRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedRequest, setSelectedRequest] = useState<RegistrationRequest | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");

  const fetchRequests = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("registration_requests")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching registration requests:", error);
      setLoading(false);
      return;
    }

    // Fetch profiles
    const userIds = data?.map(r => r.user_id) || [];
    const { data: profiles } = await supabase
      .from("profiles")
      .select("user_id, full_name, phone")
      .in("user_id", userIds);

    const profileMap = new Map(profiles?.map(p => [p.user_id, p]));
    const enrichedRequests = data?.map(req => ({
      ...req,
      profile: profileMap.get(req.user_id)
    })) || [];

    setRequests(enrichedRequests);
    setLoading(false);
  };

  useEffect(() => {
    fetchRequests();
  }, []);

  const handleStatusUpdate = async (reqId: string, newStatus: RegistrationRequest['status'], reason?: string) => {
    const { error } = await supabase
      .from("registration_requests")
      .update({
        status: newStatus,
        rejection_reason: reason || null,
        reviewed_at: new Date().toISOString()
      })
      .eq("id", reqId);

    if (error) {
      toast({
        title: "Error",
        description: "Failed to update registration status",
        variant: "destructive"
      });
      return;
    }

    // Also update profile verification status if approved
    if (newStatus === 'approved') {
      const request = requests.find(r => r.id === reqId);
      if (request) {
        await supabase
          .from("profiles")
          .update({ is_verified: true })
          .eq("user_id", request.user_id);
      }
    }

    toast({
      title: "Success",
      description: `Registration ${statusConfig[newStatus].label.toLowerCase()}`,
    });

    fetchRequests();
    setSelectedRequest(null);
    setRejectionReason("");
  };

  const filteredRequests = requests.filter(req => {
    const matchesSearch = req.profile?.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          req.company_name?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === "all" || req.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const stats = {
    total: requests.length,
    pending: requests.filter(r => r.status === 'pending').length,
    approved: requests.filter(r => r.status === 'approved').length,
    rejected: requests.filter(r => r.status === 'rejected').length,
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
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
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
            <div className="text-2xl font-bold text-green-700">{stats.approved}</div>
            <div className="text-sm text-green-600">Approved</div>
          </CardContent>
        </Card>
        <Card className="border-red-200 bg-red-50/50">
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-red-700">{stats.rejected}</div>
            <div className="text-sm text-red-600">Rejected</div>
          </CardContent>
        </Card>
      </div>

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="w-5 h-5" />
            Registration Requests
          </CardTitle>
          <CardDescription>Review and approve new user registrations</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search by name or company..."
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
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
                <SelectItem value="resubmission_required">Resubmission</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="rounded-lg border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead>User</TableHead>
                  <TableHead>Company</TableHead>
                  <TableHead>Country</TableHead>
                  <TableHead>Verification</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Submitted</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRequests.map((req) => {
                  const StatusIcon = statusConfig[req.status].icon;
                  return (
                    <TableRow key={req.id} className="hover:bg-muted/30">
                      <TableCell>
                        <div className="font-medium">{req.profile?.full_name || "Unknown"}</div>
                        <div className="text-sm text-muted-foreground">{req.profile?.phone || "No phone"}</div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Building className="w-4 h-4 text-muted-foreground" />
                          <span>{req.company_name || "—"}</span>
                        </div>
                      </TableCell>
                      <TableCell>{req.country || "—"}</TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          {req.email_verified ? (
                            <Badge variant="outline" className="text-xs bg-green-50 text-green-700">
                              <Mail className="w-3 h-3 mr-1" />
                              Email ✓
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-xs">
                              <Mail className="w-3 h-3 mr-1" />
                              Email ✗
                            </Badge>
                          )}
                          {req.terms_accepted && (
                            <Badge variant="outline" className="text-xs bg-green-50 text-green-700">Terms ✓</Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={statusConfig[req.status].color}>
                          <StatusIcon className="w-3 h-3 mr-1" />
                          {statusConfig[req.status].label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {format(new Date(req.created_at), "dd.MM.yyyy")}
                      </TableCell>
                      <TableCell className="text-right">
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button variant="ghost" size="sm" onClick={() => setSelectedRequest(req)}>
                              <Eye className="w-4 h-4 mr-1" />
                              Review
                            </Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>Review Registration</DialogTitle>
                              <DialogDescription>{req.profile?.full_name} - {req.company_name}</DialogDescription>
                            </DialogHeader>
                            <div className="space-y-4 py-4">
                              <div className="grid grid-cols-2 gap-4">
                                <div>
                                  <div className="text-sm font-medium">Full Name</div>
                                  <div className="text-sm text-muted-foreground">{req.profile?.full_name || "—"}</div>
                                </div>
                                <div>
                                  <div className="text-sm font-medium">Phone</div>
                                  <div className="text-sm text-muted-foreground">{req.profile?.phone || "—"}</div>
                                </div>
                                <div>
                                  <div className="text-sm font-medium">Company</div>
                                  <div className="text-sm text-muted-foreground">{req.company_name || "—"}</div>
                                </div>
                                <div>
                                  <div className="text-sm font-medium">Business Type</div>
                                  <div className="text-sm text-muted-foreground">{req.business_type || "—"}</div>
                                </div>
                                <div>
                                  <div className="text-sm font-medium">Country</div>
                                  <div className="text-sm text-muted-foreground">{req.country || "—"}</div>
                                </div>
                              </div>

                              {req.status === 'pending' && (
                                <div>
                                  <div className="text-sm font-medium mb-2">Rejection Reason (optional)</div>
                                  <Textarea
                                    placeholder="Enter reason for rejection or resubmission..."
                                    value={rejectionReason}
                                    onChange={(e) => setRejectionReason(e.target.value)}
                                  />
                                </div>
                              )}
                            </div>
                            {req.status === 'pending' && (
                              <div className="flex gap-2 justify-end">
                                <Button
                                  variant="outline"
                                  onClick={() => handleStatusUpdate(req.id, 'rejected', rejectionReason)}
                                >
                                  <XCircle className="w-4 h-4 mr-1" />
                                  Reject
                                </Button>
                                <Button
                                  variant="outline"
                                  onClick={() => handleStatusUpdate(req.id, 'resubmission_required', rejectionReason)}
                                >
                                  <RotateCcw className="w-4 h-4 mr-1" />
                                  Request Resubmission
                                </Button>
                                <Button
                                  onClick={() => handleStatusUpdate(req.id, 'approved')}
                                >
                                  <CheckCircle className="w-4 h-4 mr-1" />
                                  Approve
                                </Button>
                              </div>
                            )}
                          </DialogContent>
                        </Dialog>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {filteredRequests.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      No registration requests found
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
