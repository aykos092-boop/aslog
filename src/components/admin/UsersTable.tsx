import { useEffect, useState } from "react";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { 
  Users, Search, Filter, Loader2, 
  User, Truck, Shield, CheckCircle, XCircle 
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface UserWithRole {
  id: string;
  user_id: string;
  full_name: string | null;
  phone: string | null;
  is_verified: boolean;
  created_at: string;
  role: "client" | "carrier" | "admin";
}

const roleConfig = {
  client: { label: "Клиент", icon: User, color: "bg-customer text-white" },
  carrier: { label: "Перевозчик", icon: Truck, color: "bg-driver text-white" },
  admin: { label: "Админ", icon: Shield, color: "bg-primary text-primary-foreground" },
};

export const UsersTable = () => {
  const [users, setUsers] = useState<UserWithRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");

  const fetchUsers = async () => {
    setLoading(true);

    // Fetch all profiles
    const { data: profiles, error: profilesError } = await supabase
      .from("profiles")
      .select("*")
      .order("created_at", { ascending: false });

    if (profilesError) {
      console.error("Error fetching profiles:", profilesError);
      setLoading(false);
      return;
    }

    // Fetch all user roles
    const { data: roles, error: rolesError } = await supabase
      .from("user_roles")
      .select("user_id, role");

    if (rolesError) {
      console.error("Error fetching roles:", rolesError);
      setLoading(false);
      return;
    }

    const rolesMap = new Map(roles?.map(r => [r.user_id, r.role]) || []);

    const usersWithRoles: UserWithRole[] = (profiles || []).map(p => ({
      id: p.id,
      user_id: p.user_id,
      full_name: p.full_name,
      phone: p.phone,
      is_verified: p.is_verified || false,
      created_at: p.created_at,
      role: (rolesMap.get(p.user_id) as "client" | "carrier" | "admin") || "client",
    }));

    setUsers(usersWithRoles);
    setLoading(false);
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const toggleVerification = async (userId: string, currentStatus: boolean) => {
    const { error } = await supabase
      .from("profiles")
      .update({ is_verified: !currentStatus })
      .eq("user_id", userId);

    if (!error) {
      setUsers(prev => 
        prev.map(u => 
          u.user_id === userId ? { ...u, is_verified: !currentStatus } : u
        )
      );
    }
  };

  const filteredUsers = users.filter(user => {
    const matchesSearch = !searchQuery || 
      user.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.phone?.includes(searchQuery);
    
    const matchesRole = roleFilter === "all" || user.role === roleFilter;
    
    return matchesSearch && matchesRole;
  });

  const stats = {
    total: users.length,
    clients: users.filter(u => u.role === "client").length,
    carriers: users.filter(u => u.role === "carrier").length,
    verified: users.filter(u => u.is_verified).length,
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <Loader2 className="w-6 h-6 animate-spin mx-auto text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{stats.total}</div>
            <p className="text-sm text-muted-foreground">Всего</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-customer">{stats.clients}</div>
            <p className="text-sm text-muted-foreground">Клиентов</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-driver">{stats.carriers}</div>
            <p className="text-sm text-muted-foreground">Перевозчиков</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-green-500">{stats.verified}</div>
            <p className="text-sm text-muted-foreground">Верифицировано</p>
          </CardContent>
        </Card>
      </div>

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            Пользователи
          </CardTitle>
          <CardDescription>
            Управление пользователями платформы
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Поиск по имени или телефону..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger className="w-full sm:w-48">
                <Filter className="w-4 h-4 mr-2" />
                <SelectValue placeholder="Роль" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Все роли</SelectItem>
                <SelectItem value="client">Клиенты</SelectItem>
                <SelectItem value="carrier">Перевозчики</SelectItem>
                <SelectItem value="admin">Админы</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Table */}
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Пользователь</TableHead>
                  <TableHead>Роль</TableHead>
                  <TableHead>Телефон</TableHead>
                  <TableHead>Статус</TableHead>
                  <TableHead>Дата регистрации</TableHead>
                  <TableHead className="text-right">Действия</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      Пользователи не найдены
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredUsers.map((user) => {
                    const role = roleConfig[user.role];
                    const RoleIcon = role.icon;

                    return (
                      <TableRow key={user.id}>
                        <TableCell className="font-medium">
                          {user.full_name || "—"}
                        </TableCell>
                        <TableCell>
                          <Badge className={role.color}>
                            <RoleIcon className="w-3 h-3 mr-1" />
                            {role.label}
                          </Badge>
                        </TableCell>
                        <TableCell>{user.phone || "—"}</TableCell>
                        <TableCell>
                          {user.is_verified ? (
                            <Badge variant="outline" className="text-green-500 border-green-500">
                              <CheckCircle className="w-3 h-3 mr-1" />
                              Верифицирован
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-muted-foreground">
                              <XCircle className="w-3 h-3 mr-1" />
                              Не верифицирован
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          {format(new Date(user.created_at), "d MMM yyyy", { locale: ru })}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => toggleVerification(user.user_id, user.is_verified)}
                          >
                            {user.is_verified ? "Снять" : "Верифицировать"}
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
