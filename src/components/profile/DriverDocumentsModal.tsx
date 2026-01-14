import React, { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Camera, Upload, Calendar, AlertTriangle, CheckCircle2, Loader2, Trash2, Eye } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';

interface DriverDocumentsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface DocumentData {
  id?: string;
  file_url: string | null;
  expiration_date: string | null;
}

const DriverDocumentsModal: React.FC<DriverDocumentsModalProps> = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState('cdl');
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [cdlData, setCdlData] = useState<DocumentData>({ file_url: null, expiration_date: null });
  const [medicalData, setMedicalData] = useState<DocumentData>({ file_url: null, expiration_date: null });
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      fetchDocuments();
    }
  }, [isOpen]);

  const fetchDocuments = async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('driver_documents')
        .select('*')
        .eq('user_id', user.id);

      if (error) throw error;

      data?.forEach((doc: any) => {
        if (doc.document_type === 'cdl') {
          setCdlData({
            id: doc.id,
            file_url: doc.file_url,
            expiration_date: doc.expiration_date,
          });
        } else if (doc.document_type === 'medical_card') {
          setMedicalData({
            id: doc.id,
            file_url: doc.file_url,
            expiration_date: doc.expiration_date,
          });
        }
      });
    } catch (error) {
      console.error('Error fetching documents:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, documentType: 'cdl' | 'medical_card') => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setUploading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Upload file to storage
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}/${documentType}_${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('driver-documents')
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('driver-documents')
        .getPublicUrl(fileName);

      // Update or insert document record
      const currentData = documentType === 'cdl' ? cdlData : medicalData;
      
      const { error: dbError } = await supabase
        .from('driver_documents')
        .upsert({
          user_id: user.id,
          document_type: documentType,
          file_url: publicUrl,
          expiration_date: currentData.expiration_date,
        }, {
          onConflict: 'user_id,document_type'
        });

      if (dbError) throw dbError;

      // Update local state
      if (documentType === 'cdl') {
        setCdlData(prev => ({ ...prev, file_url: publicUrl }));
      } else {
        setMedicalData(prev => ({ ...prev, file_url: publicUrl }));
      }

      toast.success(`${documentType === 'cdl' ? 'CDL' : 'Medical Card'} uploaded successfully`);
    } catch (error: any) {
      console.error('Error uploading file:', error);
      toast.error('Failed to upload document');
    } finally {
      setUploading(false);
    }
  };

  const handleDateChange = async (date: string, documentType: 'cdl' | 'medical_card') => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const currentData = documentType === 'cdl' ? cdlData : medicalData;

      const { error } = await supabase
        .from('driver_documents')
        .upsert({
          user_id: user.id,
          document_type: documentType,
          file_url: currentData.file_url,
          expiration_date: date || null,
          reminder_sent: false,
        }, {
          onConflict: 'user_id,document_type'
        });

      if (error) throw error;

      if (documentType === 'cdl') {
        setCdlData(prev => ({ ...prev, expiration_date: date }));
      } else {
        setMedicalData(prev => ({ ...prev, expiration_date: date }));
      }

      toast.success('Expiration date saved');
    } catch (error) {
      console.error('Error saving date:', error);
      toast.error('Failed to save date');
    }
  };

  const handleDeleteDocument = async (documentType: 'cdl' | 'medical_card') => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase
        .from('driver_documents')
        .delete()
        .eq('user_id', user.id)
        .eq('document_type', documentType);

      if (error) throw error;

      if (documentType === 'cdl') {
        setCdlData({ file_url: null, expiration_date: null });
      } else {
        setMedicalData({ file_url: null, expiration_date: null });
      }

      toast.success('Document deleted');
    } catch (error) {
      console.error('Error deleting document:', error);
      toast.error('Failed to delete document');
    }
  };

  const getDaysUntilExpiration = (expirationDate: string | null): number | null => {
    if (!expirationDate) return null;
    const today = new Date();
    const expDate = new Date(expirationDate);
    const diffTime = expDate.getTime() - today.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  const getExpirationStatus = (expirationDate: string | null) => {
    const days = getDaysUntilExpiration(expirationDate);
    if (days === null) return null;
    
    if (days < 0) {
      return { status: 'expired', color: 'destructive', text: 'Expired' };
    } else if (days <= 10) {
      return { status: 'urgent', color: 'destructive', text: `Expires in ${days} days!` };
    } else if (days <= 30) {
      return { status: 'warning', color: 'warning', text: `Expires in ${days} days` };
    } else {
      return { status: 'ok', color: 'success', text: `Valid for ${days} days` };
    }
  };

  const renderDocumentSection = (documentType: 'cdl' | 'medical_card', data: DocumentData) => {
    const title = documentType === 'cdl' ? 'CDL (Commercial Driver License)' : 'DOT Medical Card';
    const expirationStatus = getExpirationStatus(data.expiration_date);

    return (
      <div className="space-y-4">
        {/* Expiration Alert */}
        {expirationStatus && (expirationStatus.status === 'expired' || expirationStatus.status === 'urgent') && (
          <div className={`p-3 rounded-lg flex items-center gap-2 ${
            expirationStatus.status === 'expired' ? 'bg-destructive/20' : 'bg-warning/20'
          }`}>
            <AlertTriangle className={`w-5 h-5 ${
              expirationStatus.status === 'expired' ? 'text-destructive' : 'text-warning'
            }`} />
            <span className={`text-sm font-medium ${
              expirationStatus.status === 'expired' ? 'text-destructive' : 'text-warning'
            }`}>
              {expirationStatus.text}
            </span>
          </div>
        )}

        {/* Document Preview */}
        <div className="border-2 border-dashed border-border rounded-xl p-6 text-center">
          {data.file_url ? (
            <div className="space-y-3">
              <div className="relative w-full h-40 bg-secondary rounded-lg overflow-hidden">
                <img 
                  src={data.file_url} 
                  alt={title}
                  className="w-full h-full object-contain"
                />
              </div>
              <div className="flex gap-2 justify-center">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => window.open(data.file_url!, '_blank')}
                >
                  <Eye className="w-4 h-4 mr-1" />
                  View
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleDeleteDocument(documentType)}
                  className="text-destructive hover:text-destructive"
                >
                  <Trash2 className="w-4 h-4 mr-1" />
                  Remove
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="w-16 h-16 bg-secondary rounded-full mx-auto flex items-center justify-center">
                <Camera className="w-8 h-8 text-muted-foreground" />
              </div>
              <p className="text-sm text-muted-foreground">No document uploaded</p>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={(e) => handleFileUpload(e, documentType)}
                className="hidden"
              />
              <Button
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
              >
                {uploading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Uploading...
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4 mr-2" />
                    Upload Photo
                  </>
                )}
              </Button>
            </div>
          )}
        </div>

        {/* Expiration Date */}
        <div className="space-y-2">
          <Label className="flex items-center gap-2">
            <Calendar className="w-4 h-4" />
            Expiration Date
          </Label>
          <div className="flex items-center gap-3">
            <Input
              type="date"
              value={data.expiration_date || ''}
              onChange={(e) => handleDateChange(e.target.value, documentType)}
              className="flex-1"
            />
            {expirationStatus && expirationStatus.status === 'ok' && (
              <Badge variant="outline" className="bg-success/20 text-success border-success/30">
                <CheckCircle2 className="w-3 h-3 mr-1" />
                Valid
              </Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            You'll receive a reminder 10 days before expiration
          </p>
        </div>

        {/* Update Photo Button */}
        {data.file_url && (
          <div>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => handleFileUpload(e, documentType)}
              className="hidden"
              id={`file-input-${documentType}`}
            />
            <Button
              variant="outline"
              className="w-full"
              onClick={() => document.getElementById(`file-input-${documentType}`)?.click()}
              disabled={uploading}
            >
              {uploading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <Camera className="w-4 h-4 mr-2" />
                  Update Photo
                </>
              )}
            </Button>
          </div>
        )}
      </div>
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            📄 My Documents
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : (
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid grid-cols-2 w-full">
              <TabsTrigger value="cdl" className="text-sm">
                CDL
                {cdlData.expiration_date && getDaysUntilExpiration(cdlData.expiration_date) !== null && 
                 getDaysUntilExpiration(cdlData.expiration_date)! <= 10 && (
                  <span className="ml-1 w-2 h-2 bg-destructive rounded-full" />
                )}
              </TabsTrigger>
              <TabsTrigger value="medical" className="text-sm">
                Medical Card
                {medicalData.expiration_date && getDaysUntilExpiration(medicalData.expiration_date) !== null && 
                 getDaysUntilExpiration(medicalData.expiration_date)! <= 10 && (
                  <span className="ml-1 w-2 h-2 bg-destructive rounded-full" />
                )}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="cdl" className="mt-4">
              {renderDocumentSection('cdl', cdlData)}
            </TabsContent>

            <TabsContent value="medical" className="mt-4">
              {renderDocumentSection('medical_card', medicalData)}
            </TabsContent>
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default DriverDocumentsModal;
