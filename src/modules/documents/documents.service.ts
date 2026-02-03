import { supabase } from '@/integrations/supabase/client';

export enum DocumentType {
  // Order documents
  TRANSPORT_CONTRACT = 'transport_contract',
  WAYBILL = 'waybill',
  COMPLETION_ACT = 'completion_act',
  INVOICE = 'invoice',
  CMR = 'cmr',
  // Driver documents
  PASSPORT = 'passport',
  DRIVERS_LICENSE = 'drivers_license',
  VEHICLE_REGISTRATION = 'vehicle_registration',
  INSURANCE = 'insurance',
  LICENSE = 'license',
  ADR = 'adr'
}

export enum DocumentStatus {
  UPLOADED = 'uploaded',
  VERIFIED = 'verified',
  REJECTED = 'rejected',
  EXPIRED = 'expired'
}

export interface Document {
  id: string;
  user_id: string;
  order_id?: string;
  type: DocumentType;
  file_path: string;
  file_name: string;
  file_size?: number;
  mime_type?: string;
  status: DocumentStatus;
  verification_notes?: string;
  expires_at?: string;
  created_at: string;
  updated_at: string;
  verified_at?: string;
  verified_by?: string;
}

export interface DocumentTemplate {
  type: DocumentType;
  name: string;
  description: string;
  required_fields: string[];
  template_url?: string;
  auto_generate: boolean;
}

export class DocumentsService {
  // Upload document
  static async uploadDocument(
    userId: string,
    file: File,
    documentType: DocumentType,
    options: {
      orderId?: string;
      expiresAt?: string;
      description?: string;
    } = {}
  ): Promise<Document | null> {
    try {
      // Generate unique file name
      const fileExt = file.name.split('.').pop();
      const fileName = `${userId}/${Date.now()}_${documentType}.${fileExt}`;
      
      // Upload file to storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('documents')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: false
        });

      if (uploadError) {
        console.error('Error uploading file:', uploadError);
        throw uploadError;
      }

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('documents')
        .getPublicUrl(fileName);

      // Create document record
      const { data, error } = await supabase
        .from('documents')
        .insert({
          user_id: userId,
          order_id: options.orderId,
          type: documentType,
          file_path: urlData.publicUrl,
          file_name: file.name,
          file_size: file.size,
          mime_type: file.type,
          status: DocumentStatus.UPLOADED,
          expires_at: options.expiresAt,
          metadata: {
            original_filename: file.name,
            uploaded_at: new Date().toISOString(),
            description: options.description
          }
        })
        .select()
        .single();

      if (error) {
        console.error('Error creating document record:', error);
        // Clean up uploaded file
        await supabase.storage.from('documents').remove([fileName]);
        throw error;
      }

      return data as Document;
    } catch (error) {
      console.error('Error uploading document:', error);
      return null;
    }
  }

  // Get user documents
  static async getUserDocuments(
    userId: string,
    options: {
      type?: DocumentType;
      status?: DocumentStatus;
      orderId?: string;
      limit?: number;
      offset?: number;
    } = {}
  ): Promise<Document[]> {
    try {
      let query = supabase
        .from('documents')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (options.type) {
        query = query.eq('type', options.type);
      }

      if (options.status) {
        query = query.eq('status', options.status);
      }

      if (options.orderId) {
        query = query.eq('order_id', options.orderId);
      }

      if (options.limit) {
        query = query.limit(options.limit);
      }

      if (options.offset) {
        query = query.range(options.offset, options.offset + (options.limit || 10) - 1);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching user documents:', error);
        return [];
      }

      return (data as Document[]) || [];
    } catch (error) {
      console.error('Error getting user documents:', error);
      return [];
    }
  }

  // Get document by ID
  static async getDocument(documentId: string): Promise<Document | null> {
    try {
      const { data, error } = await supabase
        .from('documents')
        .select('*')
        .eq('id', documentId)
        .single();

      if (error) {
        console.error('Error fetching document:', error);
        return null;
      }

      return data as Document;
    } catch (error) {
      console.error('Error getting document:', error);
      return null;
    }
  }

  // Verify document (admin only)
  static async verifyDocument(
    documentId: string,
    verifiedBy: string,
    status: DocumentStatus.VERIFIED | DocumentStatus.REJECTED,
    notes?: string
  ): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('documents')
        .update({
          status,
          verification_notes: notes,
          verified_at: new Date().toISOString(),
          verified_by: verifiedBy
        })
        .eq('id', documentId);

      if (error) {
        console.error('Error verifying document:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error verifying document:', error);
      return false;
    }
  }

  // Delete document
  static async deleteDocument(documentId: string, userId: string): Promise<boolean> {
    try {
      // Get document info
      const document = await this.getDocument(documentId);
      if (!document) {
        return false;
      }

      // Check ownership
      if (document.user_id !== userId) {
        throw new Error('Unauthorized to delete this document');
      }

      // Delete file from storage
      const fileName = document.file_path.split('/').pop();
      if (fileName) {
        await supabase.storage.from('documents').remove([`${userId}/${fileName}`]);
      }

      // Delete database record
      const { error } = await supabase
        .from('documents')
        .delete()
        .eq('id', documentId);

      if (error) {
        console.error('Error deleting document:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error deleting document:', error);
      return false;
    }
  }

  // Get documents for order
  static async getOrderDocuments(orderId: string): Promise<Document[]> {
    try {
      const { data, error } = await supabase
        .from('documents')
        .select('*')
        .eq('order_id', orderId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching order documents:', error);
        return [];
      }

      return (data as Document[]) || [];
    } catch (error) {
      console.error('Error getting order documents:', error);
      return [];
    }
  }

  // Check if user has required documents for their role
  static async checkRequiredDocuments(userId: string, userRole: string): Promise<{
    hasAllRequired: boolean;
    missingDocuments: DocumentType[];
    expiringSoon: Document[];
  }> {
    try {
      const requiredDocs = this.getRequiredDocumentsForRole(userRole);
      const userDocs = await this.getUserDocuments(userId);
      
      const uploadedTypes = new Set(userDocs.map(doc => doc.type));
      const missingTypes = requiredDocs.filter(type => !uploadedTypes.has(type));
      
      // Check expiring documents
      const now = new Date();
      const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
      const expiringSoon = userDocs.filter(doc => 
        doc.expires_at && 
        new Date(doc.expires_at) <= thirtyDaysFromNow &&
        new Date(doc.expires_at) > now
      );

      return {
        hasAllRequired: missingTypes.length === 0,
        missingDocuments: missingTypes,
        expiringSoon
      };
    } catch (error) {
      console.error('Error checking required documents:', error);
      return {
        hasAllRequired: false,
        missingDocuments: [],
        expiringSoon: []
      };
    }
  }

  // Get required documents for role
  private static getRequiredDocumentsForRole(role: string): DocumentType[] {
    switch (role) {
      case 'carrier':
        return [
          DocumentType.PASSPORT,
          DocumentType.DRIVERS_LICENSE,
          DocumentType.VEHICLE_REGISTRATION,
          DocumentType.INSURANCE
        ];
      case 'client':
        return [
          DocumentType.PASSPORT
        ];
      default:
        return [];
    }
  }

  // Generate document PDF
  static async generateDocumentPDF(
    documentType: DocumentType,
    data: any,
    options: {
      orderId?: string;
      userId?: string;
    } = {}
  ): Promise<string | null> {
    try {
      // Call PDF generation edge function
      const { data: result, error } = await supabase.functions.invoke('generate-pdf', {
        body: {
          documentType,
          data,
          options
        }
      });

      if (error) {
        console.error('Error generating PDF:', error);
        return null;
      }

      return result?.url || null;
    } catch (error) {
      console.error('Error generating document PDF:', error);
      return null;
    }
  }

  // Get document templates
  static getDocumentTemplates(): DocumentTemplate[] {
    return [
      {
        type: DocumentType.TRANSPORT_CONTRACT,
        name: 'Договор перевозки',
        description: 'Договор между клиентом и перевозчиком',
        required_fields: ['client_info', 'carrier_info', 'cargo_details', 'route', 'price'],
        auto_generate: true
      },
      {
        type: DocumentType.WAYBILL,
        name: 'Товарно-транспортная накладная',
        description: 'ТТН для перевозки груза',
        required_fields: ['sender', 'receiver', 'cargo', 'vehicle', 'driver'],
        auto_generate: true
      },
      {
        type: DocumentType.COMPLETION_ACT,
        name: 'Акт выполненных работ',
        description: 'Подтверждение доставки груза',
        required_fields: ['order_info', 'completion_date', 'signatures'],
        auto_generate: true
      },
      {
        type: DocumentType.INVOICE,
        name: 'Инвойс',
        description: 'Счет на оплату услуг',
        required_fields: ['billing_info', 'services', 'amounts', 'payment_terms'],
        auto_generate: true
      },
      {
        type: DocumentType.CMR,
        name: 'CMR',
        description: 'Международная товарно-транспортная накладная',
        required_fields: ['consignor', 'consignee', 'carrier', 'goods', 'route'],
        auto_generate: true
      }
    ];
  }

  // Get document statistics
  static async getDocumentStats(userId?: string): Promise<{
    total_documents: number;
    verified_documents: number;
    pending_documents: number;
    rejected_documents: number;
    expiring_soon: number;
    documents_by_type: Record<string, number>;
  }> {
    try {
      let query = supabase
        .from('documents')
        .select('type, status, expires_at');

      if (userId) {
        query = query.eq('user_id', userId);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching document stats:', error);
        return {
          total_documents: 0,
          verified_documents: 0,
          pending_documents: 0,
          rejected_documents: 0,
          expiring_soon: 0,
          documents_by_type: {}
        };
      }

      const stats = {
        total_documents: data?.length || 0,
        verified_documents: 0,
        pending_documents: 0,
        rejected_documents: 0,
        expiring_soon: 0,
        documents_by_type: {} as Record<string, number>
      };

      const now = new Date();
      const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

      (data as any[])?.forEach((doc: any) => {
        // Count by status
        switch (doc.status) {
          case DocumentStatus.VERIFIED:
            stats.verified_documents += 1;
            break;
          case DocumentStatus.UPLOADED:
            stats.pending_documents += 1;
            break;
          case DocumentStatus.REJECTED:
            stats.rejected_documents += 1;
            break;
        }

        // Count by type
        stats.documents_by_type[doc.type] = (stats.documents_by_type[doc.type] || 0) + 1;

        // Check expiring soon
        if (doc.expires_at) {
          const expiresAt = new Date(doc.expires_at);
          if (expiresAt <= thirtyDaysFromNow && expiresAt > now) {
            stats.expiring_soon += 1;
          }
        }
      });

      return stats;
    } catch (error) {
      console.error('Error getting document stats:', error);
      return {
        total_documents: 0,
        verified_documents: 0,
        pending_documents: 0,
        rejected_documents: 0,
        expiring_soon: 0,
        documents_by_type: {}
      };
    }
  }

  // Generate QR code for document verification
  static generateDocumentQR(documentId: string): string {
    const baseUrl = window.location.origin;
    return `${baseUrl}/verify-document/${documentId}`;
  }

  // Verify document by QR code
  static async verifyDocumentByQR(documentId: string): Promise<Document | null> {
    return this.getDocument(documentId);
  }

  // Bulk upload documents
  static async bulkUploadDocuments(
    userId: string,
    files: File[],
    documentType: DocumentType,
    options: {
      orderId?: string;
      expiresAt?: string;
    } = {}
  ): Promise<Document[]> {
    const results: Document[] = [];

    for (const file of files) {
      const document = await this.uploadDocument(userId, file, documentType, options);
      if (document) {
        results.push(document);
      }
    }

    return results;
  }

  // Get document download URL
  static async getDocumentDownloadUrl(documentId: string): Promise<string | null> {
    try {
      const document = await this.getDocument(documentId);
      if (!document) {
        return null;
      }

      // Extract file path from URL
      const urlParts = document.file_path.split('/');
      const fileName = urlParts[urlParts.length - 1];
      const filePath = `${document.user_id}/${fileName}`;

      const { data } = supabase.storage
        .from('documents')
        .getPublicUrl(filePath);

      return data.publicUrl;
    } catch (error) {
      console.error('Error getting document download URL:', error);
      return null;
    }
  }
}
