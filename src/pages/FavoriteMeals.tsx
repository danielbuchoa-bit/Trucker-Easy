import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Heart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import FavoriteMealsList from '@/components/stops/FavoriteMealsList';

export default function FavoriteMeals() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-background border-b">
        <div className="flex items-center gap-3 p-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-2">
            <Heart className="h-5 w-5 text-red-500" />
            <h1 className="text-xl font-bold">Favorite Meals</h1>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="p-4">
        <FavoriteMealsList />
      </main>
    </div>
  );
}
