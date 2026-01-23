import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Pill, History, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import BottomNav from '@/components/navigation/BottomNav';
import MedicationsList from '@/components/medication/MedicationsList';
import MedicationForm from '@/components/medication/MedicationForm';
import MedicationHistory from '@/components/medication/MedicationHistory';
import { useMedications, Medication, MedicationFormData } from '@/hooks/useMedications';
import { Skeleton } from '@/components/ui/skeleton';

const MedicationsPage: React.FC = () => {
  const navigate = useNavigate();
  const { 
    medications, 
    logs, 
    loading, 
    addMedication, 
    updateMedication,
    togglePause, 
    deleteMedication,
    getAdherenceStats,
    getNextReminder,
  } = useMedications();

  const [formOpen, setFormOpen] = useState(false);
  const [editingMedication, setEditingMedication] = useState<Medication | null>(null);

  const handleAdd = () => {
    setEditingMedication(null);
    setFormOpen(true);
  };

  const handleEdit = (medication: Medication) => {
    setEditingMedication(medication);
    setFormOpen(true);
  };

  const handleSubmit = async (data: MedicationFormData): Promise<boolean> => {
    if (editingMedication) {
      return updateMedication(editingMedication.id, data);
    }
    return addMedication(data);
  };

  const adherenceStats = getAdherenceStats(7);

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border">
        <div className="flex items-center gap-4 p-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex items-center gap-2">
            <Pill className="w-5 h-5 text-primary" />
            <h1 className="text-lg font-semibold">Medicamentos</h1>
          </div>
        </div>
      </div>

      <div className="p-4">
        {loading ? (
          <div className="space-y-4">
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        ) : (
          <Tabs defaultValue="list" className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-4">
              <TabsTrigger value="list" className="flex items-center gap-2">
                <Pill className="w-4 h-4" />
                Meus Medicamentos
              </TabsTrigger>
              <TabsTrigger value="history" className="flex items-center gap-2">
                <History className="w-4 h-4" />
                Histórico
              </TabsTrigger>
            </TabsList>

            <TabsContent value="list">
              <MedicationsList
                medications={medications}
                onAdd={handleAdd}
                onEdit={handleEdit}
                onTogglePause={togglePause}
                onDelete={deleteMedication}
                getNextReminder={getNextReminder}
              />
            </TabsContent>

            <TabsContent value="history">
              <MedicationHistory
                logs={logs}
                medications={medications}
                adherenceStats={adherenceStats}
              />
            </TabsContent>
          </Tabs>
        )}
      </div>

      {/* Form Sheet */}
      <MedicationForm
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onSubmit={handleSubmit}
        medication={editingMedication}
      />

      <BottomNav activeTab="profile" onTabChange={(tab) => navigate(`/${tab === 'map' ? 'home' : tab}`)} />
    </div>
  );
};

export default MedicationsPage;
