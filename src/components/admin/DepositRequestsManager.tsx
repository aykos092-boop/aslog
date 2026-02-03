import { useState, useEffect } from "react";
import { 
  CheckCircle, XCircle, Clock, Eye, Download, 
  Wallet, CreditCard, User, Calendar
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface DepositRequest {
  id: string;
  user_id: string;
  amount: number;
  card_number: string;
  card_holder: string;
  description: string;
  receipt_url: string;
  status: 'pending' | 'approved' | 'rejected';
  admin_notes?: string;
  processed_by?: string;
  processed_at?: string;
  created_at: string;
  profiles?: {
    full_name: string;
    email: string;
    phone: string;
  };
}

const DepositRequestsManager = () => {
  const { toast } = useToast();
  const [requests, setRequests] = useState<DepositRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRequest, setSelectedRequest] = useState<DepositRequest | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [adminNotes, setAdminNotes] = useState('');
  const [processingId, setProcessingId] = useState<string | null>(null);

  useEffect(() => {
    loadRequests();
  }, [statusFilter]);

  const loadRequests = async () => {
    try {
      let query = supabase
        .from('deposit_requests')
        .select(`
          *,
          profiles!inner(
            full_name,
            email,
            phone
          )
        `)
        .order('created_at', { ascending: false });

      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
      }

      const { data, error } = await query;

      if (!error && data) {
        setRequests(data as DepositRequest[]);
      }
    } catch (error) {
      console.error('Error loading requests:', error);
      toast({
        title: "Ошибка",
        description: "Не удалось загрузить заявки",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (requestId: string) => {
    setProcessingId(requestId);
    
    try {
      // Получаем заявку
      const { data: request, error: fetchError } = await supabase
        .from('deposit_requests')
        .select('*')
        .eq('id', requestId)
        .single();

      if (fetchError || !request) {
        throw new Error('Заявка не найдена');
      }

      // Обновляем статус заявки
      const { error: updateError } = await supabase
        .from('deposit_requests')
        .update({
          status: 'approved',
          admin_notes: adminNotes,
          processed_at: new Date().toISOString()
        })
        .eq('id', requestId);

      if (updateError) {
        throw updateError;
      }

      // Пополняем баланс пользователя
      const { error: balanceError } = await supabase.rpc('add_user_balance', {
        p_user_id: request.user_id,
        p_amount: request.amount
      });

      if (balanceError) {
        throw balanceError;
      }

      // Создаем транзакцию
      await supabase
        .from('transactions')
        .insert({
          user_id: request.user_id,
          type: 'deposit',
          amount: request.amount,
          status: 'confirmed',
          description: `Пополнение баланса (заявка #${requestId.slice(0, 8)})`,
          metadata: {
            deposit_request_id: requestId,
            card_holder: request.card_holder,
            admin_notes: adminNotes
          }
        });

      toast({
        title: "✅ Одобрено!",
        description: `Баланс пополнен на ${request.amount.toLocaleString()} UZS`,
      });

      setAdminNotes('');
      setSelectedRequest(null);
      await loadRequests();

    } catch (error) {
      console.error('Error approving request:', error);
      toast({
        title: "❌ Ошибка",
        description: "Не удалось одобрить заявку",
        variant: "destructive",
      });
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (requestId: string) => {
    setProcessingId(requestId);
    
    try {
      const { error } = await supabase
        .from('deposit_requests')
        .update({
          status: 'rejected',
          admin_notes: adminNotes,
          processed_at: new Date().toISOString()
        })
        .eq('id', requestId);

      if (error) {
        throw error;
      }

      toast({
        title: "❌ Отклонено",
        description: "Заявка отклонена",
      });

      setAdminNotes('');
      setSelectedRequest(null);
      await loadRequests();

    } catch (error) {
      console.error('Error rejecting request:', error);
      toast({
        title: "❌ Ошибка",
        description: "Не удалось отклонить заявку",
        variant: "destructive",
      });
    } finally {
      setProcessingId(null);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge className="bg-yellow-100 text-yellow-800"><Clock className="w-3 h-3 mr-1" />На проверке</Badge>;
      case 'approved':
        return <Badge className="bg-green-100 text-green-800"><CheckCircle className="w-3 h-3 mr-1" />Одобрено</Badge>;
      case 'rejected':
        return <Badge className="bg-red-100 text-red-800"><XCircle className="w-3 h-3 mr-1" />Отклонено</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  const pendingCount = requests.filter(r => r.status === 'pending').length;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Статистика */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6 text-center">
            <Wallet className="w-8 h-8 mx-auto mb-2 text-primary" />
            <div className="text-2xl font-bold">{requests.length}</div>
            <p className="text-sm text-muted-foreground">Всего заявок</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <Clock className="w-8 h-8 mx-auto mb-2 text-yellow-500" />
            <div className="text-2xl font-bold">{pendingCount}</div>
            <p className="text-sm text-muted-foreground">На проверке</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <CheckCircle className="w-8 h-8 mx-auto mb-2 text-green-500" />
            <div className="text-2xl font-bold">
              {requests.filter(r => r.status === 'approved').length}
            </div>
            <p className="text-sm text-muted-foreground">Одобрено</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <XCircle className="w-8 h-8 mx-auto mb-2 text-red-500" />
            <div className="text-2xl font-bold">
              {requests.filter(r => r.status === 'rejected').length}
            </div>
            <p className="text-sm text-muted-foreground">Отклонено</p>
          </CardContent>
        </Card>
      </div>

      {/* Фильтры */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-4">
            <Label htmlFor="status-filter">Фильтр по статусу:</Label>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Все заявки</SelectItem>
                <SelectItem value="pending">На проверке</SelectItem>
                <SelectItem value="approved">Одобренные</SelectItem>
                <SelectItem value="rejected">Отклоненные</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Список заявок */}
      <div className="space-y-4">
        {requests.map((request) => (
          <Card key={request.id} className="relative">
            <CardContent className="pt-6">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-3">
                    {getStatusBadge(request.status)}
                    <div className="font-semibold text-lg">
                      {request.amount.toLocaleString()} UZS
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <User className="w-4 h-4" />
                        <span>{request.profiles?.full_name || 'Неизвестно'}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <CreditCard className="w-4 h-4" />
                        <span>****{request.card_number.slice(-4)}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4" />
                        <span>{new Date(request.created_at).toLocaleString('ru-RU')}</span>
                      </div>
                    </div>
                    
                    <div className="space-y-1">
                      <div><strong>Email:</strong> {request.profiles?.email || 'Не указан'}</div>
                      <div><strong>Телефон:</strong> {request.profiles?.phone || 'Не указан'}</div>
                      <div><strong>Держатель:</strong> {request.card_holder}</div>
                    </div>
                  </div>

                  {request.description && (
                    <div className="mt-3 p-2 bg-muted rounded text-sm">
                      <strong>Комментарий:</strong> {request.description}
                    </div>
                  )}

                  {request.admin_notes && (
                    <div className="mt-3 p-2 bg-blue-50 rounded text-sm">
                      <strong>Комментарий админа:</strong> {request.admin_notes}
                    </div>
                  )}
                </div>

                <div className="flex flex-col gap-2 ml-4">
                  {request.receipt_url && (
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button variant="outline" size="sm">
                          <Eye className="w-4 h-4 mr-1" />
                          Чек
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-4xl">
                        <DialogHeader>
                          <DialogTitle>Чек пополнения</DialogTitle>
                          <DialogDescription>
                            Заявка #{request.id.slice(0, 8)} от {new Date(request.created_at).toLocaleDateString('ru-RU')}
                          </DialogDescription>
                        </DialogHeader>
                        <div className="mt-4">
                          <img 
                            src={request.receipt_url} 
                            alt="Чек" 
                            className="max-w-full h-auto rounded border"
                          />
                          <div className="mt-4 flex justify-end">
                            <Button asChild>
                              <a href={request.receipt_url} download="чек.png" target="_blank">
                                <Download className="w-4 h-4 mr-2" />
                                Скачать
                              </a>
                            </Button>
                          </div>
                        </div>
                      </DialogContent>
                    </Dialog>
                  )}

                  {request.status === 'pending' && (
                    <div className="flex gap-2">
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button 
                            size="sm" 
                            className="bg-green-600 hover:bg-green-700"
                            onClick={() => setSelectedRequest(request)}
                          >
                            <CheckCircle className="w-4 h-4 mr-1" />
                            Одобрить
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Одобрить заявку</DialogTitle>
                            <DialogDescription>
                              Вы уверены что хотите одобрить заявку на {request.amount.toLocaleString()} UZS?
                            </DialogDescription>
                          </DialogHeader>
                          <div className="space-y-4 mt-4">
                            <div>
                              <Label htmlFor="admin-notes">Комментарий (необязательно)</Label>
                              <Textarea
                                id="admin-notes"
                                placeholder="Добавьте комментарий..."
                                value={adminNotes}
                                onChange={(e) => setAdminNotes(e.target.value)}
                                rows={3}
                              />
                            </div>
                            <div className="flex gap-2 justify-end">
                              <Button 
                                variant="outline" 
                                onClick={() => {
                                  setSelectedRequest(null);
                                  setAdminNotes('');
                                }}
                              >
                                Отмена
                              </Button>
                              <Button 
                                onClick={() => handleApprove(request.id)}
                                disabled={processingId === request.id}
                              >
                                {processingId === request.id ? (
                                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                ) : (
                                  'Одобрить'
                                )}
                              </Button>
                            </div>
                          </div>
                        </DialogContent>
                      </Dialog>

                      <Dialog>
                        <DialogTrigger asChild>
                          <Button 
                            variant="destructive" 
                            size="sm"
                            onClick={() => setSelectedRequest(request)}
                          >
                            <XCircle className="w-4 h-4 mr-1" />
                            Отклонить
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Отклонить заявку</DialogTitle>
                            <DialogDescription>
                              Укажите причину отклонения заявки на {request.amount.toLocaleString()} UZS
                            </DialogDescription>
                          </DialogHeader>
                          <div className="space-y-4 mt-4">
                            <div>
                              <Label htmlFor="reject-notes">Причина отклонения *</Label>
                              <Textarea
                                id="reject-notes"
                                placeholder="Укажите причину отклонения..."
                                value={adminNotes}
                                onChange={(e) => setAdminNotes(e.target.value)}
                                rows={3}
                                required
                              />
                            </div>
                            <div className="flex gap-2 justify-end">
                              <Button 
                                variant="outline" 
                                onClick={() => {
                                  setSelectedRequest(null);
                                  setAdminNotes('');
                                }}
                              >
                                Отмена
                              </Button>
                              <Button 
                                variant="destructive"
                                onClick={() => handleReject(request.id)}
                                disabled={processingId === request.id || !adminNotes.trim()}
                              >
                                {processingId === request.id ? (
                                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                ) : (
                                  'Отклонить'
                                )}
                              </Button>
                            </div>
                          </div>
                        </DialogContent>
                      </Dialog>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default DepositRequestsManager;
