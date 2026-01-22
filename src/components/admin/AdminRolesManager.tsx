import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { 
  Loader2, 
  Shield,
  Crown,
  Users,
  Eye,
  Settings
} from "lucide-react";
import { format } from "date-fns";

interface AdminRole {
  id: string;
  user_id: string;
  admin_role: 'super_admin' | 'manager' | 'operator' | 'auditor';
  permissions: any;
  created_at: string;
  profile?: {
    full_name: string | null;
    phone: string | null;
  };
  email?: string;
}

const roleConfig = {
  super_admin: { label: "Super Admin", icon: Crown, color: "bg-purple-100 text-purple-700", description: "Full system access" },
  manager: { label: "Manager", icon: Users, color: "bg-blue-100 text-blue-700", description: "Manage users and deals" },
  operator: { label: "Operator", icon: Settings, color: "bg-green-100 text-green-700", description: "Handle daily operations" },
  auditor: { label: "Auditor", icon: Eye, color: "bg-gray-100 text-gray-700", description: "View-only access" },
};

export const AdminRolesManager = () => {
  const { t } = useLanguage();
  const { toast } = useToast();
  const [adminRoles, setAdminRoles] = useState<AdminRole[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAdminRoles = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("admin_roles")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching admin roles:", error);
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
    const enrichedRoles = data?.map(role => ({
      ...role,
      profile: profileMap.get(role.user_id)
    })) || [];

    setAdminRoles(enrichedRoles);
    setLoading(false);
  };

  useEffect(() => {
    fetchAdminRoles();
  }, []);

  const handleRoleChange = async (userId: string, newRole: AdminRole['admin_role']) => {
    const { error } = await supabase
      .from("admin_roles")
      .update({ admin_role: newRole })
      .eq("user_id", userId);

    if (error) {
      toast({
        title: "Error",
        description: "Failed to update admin role",
        variant: "destructive"
      });
      return;
    }

    toast({
      title: "Success",
      description: `Admin role updated to ${roleConfig[newRole].label}`,
    });

    fetchAdminRoles();
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
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="w-5 h-5" />
          Admin Roles (RBAC)
        </CardTitle>
        <CardDescription>Manage administrator access levels and permissions</CardDescription>
      </CardHeader>
      <CardContent>
        {/* Role Legend */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          {Object.entries(roleConfig).map(([key, config]) => {
            const Icon = config.icon;
            return (
              <div key={key} className={`p-3 rounded-lg border ${config.color.replace('text-', 'border-').replace('100', '200')}`}>
                <div className="flex items-center gap-2 mb-1">
                  <Icon className="w-4 h-4" />
                  <span className="font-medium text-sm">{config.label}</span>
                </div>
                <p className="text-xs text-muted-foreground">{config.description}</p>
              </div>
            );
          })}
        </div>

        <div className="rounded-lg border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead>Admin</TableHead>
                <TableHead>Current Role</TableHead>
                <TableHead>Assigned</TableHead>
                <TableHead className="text-right">Change Role</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {adminRoles.map((adminRole) => {
                const RoleIcon = roleConfig[adminRole.admin_role].icon;
                return (
                  <TableRow key={adminRole.id} className="hover:bg-muted/30">
                    <TableCell>
                      <div className="font-medium">{adminRole.profile?.full_name || "Unknown"}</div>
                      <div className="text-sm text-muted-foreground">{adminRole.profile?.phone || "No phone"}</div>
                    </TableCell>
                    <TableCell>
                      <Badge className={roleConfig[adminRole.admin_role].color}>
                        <RoleIcon className="w-3 h-3 mr-1" />
                        {roleConfig[adminRole.admin_role].label}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {format(new Date(adminRole.created_at), "dd.MM.yyyy")}
                    </TableCell>
                    <TableCell className="text-right">
                      <Select
                        value={adminRole.admin_role}
                        onValueChange={(value) => handleRoleChange(adminRole.user_id, value as AdminRole['admin_role'])}
                      >
                        <SelectTrigger className="w-[150px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="super_admin">Super Admin</SelectItem>
                          <SelectItem value="manager">Manager</SelectItem>
                          <SelectItem value="operator">Operator</SelectItem>
                          <SelectItem value="auditor">Auditor</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                  </TableRow>
                );
              })}
              {adminRoles.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                    No admin roles configured
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
};
