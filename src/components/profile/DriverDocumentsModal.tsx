import React, { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Camera, Upload, Calendar, AlertTriangle, CheckCircle2, Loader2, Trash2, Eye, Sparkles, Truck } from 'lucide-react';
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

type DocumentType = 
  | 'cdl' 
  | 'medical_card' 
  | 'truck_registration' 
  | 'trailer_registration' 
  | 'ifta' 
  | 'irp' 
  | 'insurance' 
  | 'dot_inspection';

interface DocumentConfig {
  type: DocumentType;
  label: string;
  icon: string;
  category: 'driver' | 'truck';
}

const DOCUMENT_CONFIGS: DocumentConfig[] = [
  { type: 'cdl', label: 'CDL', icon: '🪪', category: 'driver' },
  { type: 'medical_card', label: 'Medical Card', icon: '🏥', category: 'driver' },
  { type: 'truck_registration', label: 'Truck Registration', icon: '📋', category: 'truck' },
  { type: 'trailer_registration', label: 'Trailer Registration', icon: '📄', category: 'truck' },
  { type: 'ifta', label: 'IFTA', icon: '⛽', category: 'truck' },
  { type: 'irp', label: 'IRP', icon: '🌐', category: 'truck' },
  { type: 'insurance', label: 'Insurance', icon: '🛡️', category: 'truck' },
  { type: 'dot_inspection', label: 'DOT Inspection', icon: '✅', category: 'truck' },
];

const DriverDocumentsModal: React.FC<DriverDocumentsModalProps> = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState('driver');
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState<DocumentType | null>(null);
  const [extracting, setExtracting] = useState<DocumentType | null>(null);
  const [documents, setDocuments] = useState<Record<DocumentType, DocumentData>>({
    cdl: { file_url: null, expiration_date: null },
    medical_card: { file_url: null, expiration_date: null },
    truck_registration: { file_url: null, expiration_date: null },
    trailer_registration: { file_url: null, expiration_date: null },
    ifta: { file_url: null, expiration_date: null },
    irp: { file_url: null, expiration_date: null },
    insurance: { file_url: null, expiration_date: null },
    dot_inspection: { file_url: null, expiration_date: null },
  });

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

      const newDocs = { ...documents };
      data?.forEach((doc: any) => {
        if (doc.document_type in newDocs) {
          newDocs[doc.document_type as DocumentType] = {
            id: doc.id,
            file_url: doc.file_url,
            expiration_date: doc.expiration_date,
          };
        }
      });
      setDocuments(newDocs);
    } catch (error) {
      console.error('Error fetching documents:', error);
    } finally {
      setLoading(false);
    }
  };

  const extractExpirationDate = async (imageUrl: string, documentType: DocumentType) => {
    try {
      setExtracting(documentType);
      
      const { data, error } = await supabase.functions.invoke('extract_document_date', {
        body: { imageUrl, documentType }
      });

      if (error) throw error;

      if (data.success && data.found && data.expirationDate) {
        // Auto-save the extracted date
        await handleDateChange(data.expirationDate, documentType, true);
        toast.success('📅 Expiration date detected and saved automatically!');
      } else if (data.success && !data.found) {
        toast.info(data.message || 'Could not detect expiration date. Please enter manually.');
      } else {
        toast.error('Failed to analyze document');
      }
    } catch (error) {
      console.error('Error extracting date:', error);
      toast.error('Failed to extract date. Please enter manually.');
    } finally {
      setExtracting(null);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, documentType: DocumentType) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setUploading(documentType);
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
      const currentData = documents[documentType];
      
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
      setDocuments(prev => ({
        ...prev,
        [documentType]: { ...prev[documentType], file_url: publicUrl }
      }));

      toast.success('Document uploaded successfully');
      
      // After upload, try to extract expiration date with AI
      setUploading(null);
      await extractExpirationDate(publicUrl, documentType);
      
    } catch (error: any) {
      console.error('Error uploading file:', error);
      toast.error('Failed to upload document');
      setUploading(null);
    }
  };

  const handleDateChange = async (date: string, documentType: DocumentType, silent = false) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const currentData = documents[documentType];

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

      setDocuments(prev => ({
        ...prev,
        [documentType]: { ...prev[documentType], expiration_date: date }
      }));

      if (!silent) {
        toast.success('Expiration date saved');
      }
    } catch (error) {
      console.error('Error saving date:', error);
      toast.error('Failed to save date');
    }
  };

  const handleDeleteDocument = async (documentType: DocumentType) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase
        .from('driver_documents')
        .delete()
        .eq('user_id', user.id)
        .eq('document_type', documentType);

      if (error) throw error;

      setDocuments(prev => ({
        ...prev,
        [documentType]: { file_url: null, expiration_date: null }
      }));

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

  const getExpiringDocsCount = (category: 'driver' | 'truck') => {
    return DOCUMENT_CONFIGS.filter(config => {
      if (config.category !== category) return false;
      const data = documents[config.type];
      const days = getDaysUntilExpiration(data.expiration_date);
      return days !== null && days <= 10;
    }).length;
  };

  const renderDocumentCard = (config: DocumentConfig) => {
    const data = documents[config.type];
    const expirationStatus = getExpirationStatus(data.expiration_date);
    const isUploading = uploading === config.type;
    const isExtracting = extracting === config.type;

    return (
      <div key={config.type} className="border border-border rounded-xl p-4 space-y-3 bg-card">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xl">{config.icon}</span>
            <span className="font-medium text-sm">{config.label}</span>
          </div>
          {expirationStatus && (
            <Badge 
              variant={expirationStatus.status === 'ok' ? 'outline' : 'destructive'}
              className={expirationStatus.status === 'ok' ? 'bg-success/20 text-success border-success/30' : ''}
            >
              {expirationStatus.status === 'ok' ? (
                <CheckCircle2 className="w-3 h-3 mr-1" />
              ) : (
                <AlertTriangle className="w-3 h-3 mr-1" />
              )}
              {expirationStatus.text}
            </Badge>
          )}
        </div>

        {/* Document Preview or Upload */}
        <div className="border border-dashed border-border rounded-lg p-3">
          {data.file_url ? (
            <div className="space-y-2">
              <div className="relative w-full h-24 bg-secondary rounded overflow-hidden">
                <img 
                  src={data.file_url} 
                  alt={config.label}
                  className="w-full h-full object-contain"
                />
              </div>
              <div className="flex gap-2 justify-center">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => window.open(data.file_url!, '_blank')}
                >
                  <Eye className="w-3 h-3 mr-1" />
                  View
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleDeleteDocument(config.type)}
                  className="text-destructive hover:text-destructive"
                >
                  <Trash2 className="w-3 h-3 mr-1" />
                  Remove
                </Button>
              </div>
            </div>
          ) : (
            <div className="text-center py-2">
              <input
                type="file"
                accept="image/*"
                onChange={(e) => handleFileUpload(e, config.type)}
                className="hidden"
                id={`file-input-${config.type}`}
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => document.getElementById(`file-input-${config.type}`)?.click()}
                disabled={isUploading}
                className="w-full"
              >
                {isUploading ? (
                  <>
                    <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                    Uploading...
                  </>
                ) : (
                  <>
                    <Upload className="w-3 h-3 mr-1" />
                    Upload Photo
                  </>
                )}
              </Button>
            </div>
          )}
        </div>

        {/* Expiration Date */}
        <div className="space-y-1">
          <Label className="flex items-center gap-1 text-xs">
            <Calendar className="w-3 h-3" />
            Expiration Date
            {isExtracting && (
              <span className="flex items-center gap-1 text-primary">
                <Sparkles className="w-3 h-3 animate-pulse" />
                Reading...
              </span>
            )}
          </Label>
          <div className="flex items-center gap-2">
            <Input
              type="date"
              value={data.expiration_date || ''}
              onChange={(e) => handleDateChange(e.target.value, config.type)}
              className="flex-1 h-8 text-sm"
              disabled={isExtracting}
            />
            {data.file_url && !data.expiration_date && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => extractExpirationDate(data.file_url!, config.type)}
                disabled={isExtracting}
                className="h-8"
              >
                <Sparkles className="w-3 h-3" />
              </Button>
            )}
          </div>
        </div>

        {/* Update Photo Button */}
        {data.file_url && (
          <div>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => handleFileUpload(e, config.type)}
              className="hidden"
              id={`file-update-${config.type}`}
            />
            <Button
              variant="ghost"
              size="sm"
              className="w-full text-xs"
              onClick={() => document.getElementById(`file-update-${config.type}`)?.click()}
              disabled={isUploading}
            >
              <Camera className="w-3 h-3 mr-1" />
              Update Photo
            </Button>
          </div>
        )}
      </div>
    );
  };

  const driverDocs = DOCUMENT_CONFIGS.filter(c => c.category === 'driver');
  const truckDocs = DOCUMENT_CONFIGS.filter(c => c.category === 'truck');

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            📄 My Documents
          </DialogTitle>
          <p className="text-xs text-muted-foreground">
            Upload your documents and AI will automatically detect expiration dates
          </p>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : (
          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
            <TabsList className="grid grid-cols-2 w-full">
              <TabsTrigger value="driver" className="text-sm">
                🪪 Driver
                {getExpiringDocsCount('driver') > 0 && (
                  <span className="ml-1 px-1.5 py-0.5 text-xs bg-destructive text-destructive-foreground rounded-full">
                    {getExpiringDocsCount('driver')}
                  </span>
                )}
              </TabsTrigger>
              <TabsTrigger value="truck" className="text-sm">
                <Truck className="w-4 h-4 mr-1" />
                Truck
                {getExpiringDocsCount('truck') > 0 && (
                  <span className="ml-1 px-1.5 py-0.5 text-xs bg-destructive text-destructive-foreground rounded-full">
                    {getExpiringDocsCount('truck')}
                  </span>
                )}
              </TabsTrigger>
            </TabsList>

            <ScrollArea className="flex-1 mt-4">
              <TabsContent value="driver" className="m-0 space-y-4 pr-4">
                {driverDocs.map(renderDocumentCard)}
              </TabsContent>

              <TabsContent value="truck" className="m-0 space-y-4 pr-4">
                {truckDocs.map(renderDocumentCard)}
              </TabsContent>
            </ScrollArea>
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default DriverDocumentsModal;
