import { useState, useEffect } from "react";
import { 
  CheckCircle, XCircle, Clock, Eye, Wallet, CreditCard, 
  User, Calendar, ArrowUpRight
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

interface WithdrawRequest {
  id: string;
  user_id: string;
  amount: number;
  card_number: string;
  card_holder: string;
  description: string;
  status: 'pending' | 'approved' | 'rejected' | 'processed';
  transaction_id?: string;
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

const WithdrawRequestsManager = () => {
  const { toast } = useToast();
  const [requests, setRequests] = useState<WithdrawRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRequest, setSelectedRequest] = useState<WithdrawRequest | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [adminNotes, setAdminNotes] = useState('');
  const [transactionId, setTransactionId] = useState('');
  const [processingId, setProcessingId] = useState<string | null>(null);

  useEffect(() => {
    loadRequests();
  }, [statusFilter]);

  const loadRequests = async () => {
    try {
      let query = supabase
        .from('withdraw_requests')
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
        setRequests(data as WithdrawRequest[]);
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
        .from('withdraw_requests')
        .select('*')
        .eq('id', requestId)
        .single();

      if (fetchError || !request) {
        throw new Error('Заявка не найдена');
      }

      // Обновляем статус заявки на "approved"
      const { error: updateError } = await supabase
        .from('withdraw_requests')
        .update({
          status: 'approved',
          admin_notes: adminNotes,
          transaction_id: transactionId,
          processed_at: new Date().toISOString()
        })
        .eq('id', requestId);

      if (updateError) {
        throw updateError;
      }

      toast({
        title: "✅ Одобрено!",
        description: `Заявка на ${request.amount.toLocaleString()} UZS одобрена. Выполните перевод.`,
      });

      setAdminNotes('');
      setTransactionId('');
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

  const handleProcess = async (requestId: string) => {
    setProcessingId(requestId);
    
    try {
      // Получаем заявку
      const { data: request, error: fetchError } = await supabase
        .from('withdraw_requests')
        .select('*')
        .eq('id', requestId)
        .single();

      if (fetchError || !request) {
        throw new Error('Заявка не найдена');
      }

      // Списываем баланс пользователя
      const { error: balanceError } = await supabase.rpc('subtract_user_balance', {
        p_user_id: request.user_id,
        p_amount: request.amount
      });

      if (balanceError) {
        throw balanceError;
      }

      // Обновляем статус заявки на "processed"
      const { error: updateError } = await supabase
        .from('withdraw_requests')
        .update({
          status: 'processed',
          processed_at: new Date().toISOString()
        })
        .eq('id', requestId);

      if (updateError) {
        throw updateError;
      }

      // Создаем транзакцию
      await supabase
        .from('transactions')
        .insert({
          user_id: request.user_id,
          type: 'withdraw',
          amount: request.amount,
          status: 'confirmed',
          description: `Вывод средств (заявка #${requestId.slice(0, 8)})`,
          metadata: {
            withdraw_request_id: requestId,
            card_holder: request.card_holder,
            transaction_id: request.transaction_id
          }
        });

      toast({
        title: "✅ Выплачено!",
        description: `${request.amount.toLocaleString()} UZS успешно выплачено`,
      });

      await loadRequests();

    } catch (error) {
      console.error('Error processing request:', error);
      toast({
        title: "❌ Ошибка",
        description: "Не удалось выполнить выплату",
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
        .from('withdraw_requests')
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
        return <Badge className="bg-blue-100 text-blue-800"><CheckCircle className="w-3 h-3 mr-1" />Одобрено</Badge>;
      case 'processed':
        return <Badge className="bg-green-100 text-green-800"><ArrowUpRight className="w-3 h-3 mr-1" />Выплачено</Badge>;
      case 'rejected':
        return <Badge className="bg-red-100 text-red-800"><XCircle className="w-3 h-3 mr-1" />Отклонено</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  const pendingCount = requests.filter(r => r.status === 'pending').length;
  const approvedCount = requests.filter(r => r.status === 'approved').length;

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
            <CheckCircle className="w-8 h-8 mx-auto mb-2 text-blue-500" />
            <div className="text-2xl font-bold">{approvedCount}</div>
            <p className="text-sm text-muted-foreground">Одобрено</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <ArrowUpRight className="w-8 h-8 mx-auto mb-2 text-green-500" />
            <div className="text-2xl font-bold">
              {requests.filter(r => r.status === 'processed').length}
            </div>
            <p className="text-sm text-muted-foreground">Выплачено</p>
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
                <SelectItem value="processed">Выплаченные</SelectItem>
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
                      {request.transaction_id && (
                        <div><strong>ID транзакции:</strong> {request.transaction_id}</div>
                      )}
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
                  {request.status === 'pending' && (
                    <div className="flex gap-2">
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button 
                            size="sm" 
                            className="bg-blue-600 hover:bg-blue-700"
                            onClick={() => setSelectedRequest(request)}
                          >
                            <CheckCircle className="w-4 h-4 mr-1" />
                            Одобрить
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Одобрить заявку на вывод</DialogTitle>
                            <DialogDescription>
                              Вы уверены что хотите одобрить заявку на вывод {request.amount.toLocaleString()} UZS?
                            </DialogDescription>
                          </DialogHeader>
                          <div className="space-y-4 mt-4">
                            <div>
                              <Label htmlFor="transaction-id">ID транзакции перевода *</Label>
                              <Input
                                id="transaction-id"
                                placeholder="1234567890"
                                value={transactionId}
                                onChange={(e) => setTransactionId(e.target.value)}
                                required
                              />
                            </div>
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
                                  setTransactionId('');
                                }}
                              >
                                Отмена
                              </Button>
                              <Button 
                                onClick={() => handleApprove(request.id)}
                                disabled={processingId === request.id || !transactionId.trim()}
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
                              Укажите причину отклонения заявки на вывод {request.amount.toLocaleString()} UZS
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

                  {request.status === 'approved' && (
                    <Button 
                      size="sm" 
                      className="bg-green-600 hover:bg-green-700"
                      onClick={() => handleProcess(request.id)}
                      disabled={processingId === request.id}
                    >
                      {processingId === request.id ? (
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <>
                          <ArrowUpRight className="w-4 h-4 mr-1" />
                          Выплатить
                        </>
                      )}
                    </Button>
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

export default WithdrawRequestsManager;
