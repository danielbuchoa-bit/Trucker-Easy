import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Utensils, Loader2, Save } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { DriverFoodProfile } from '@/types/stops';

interface FoodProfileFormProps {
  profile?: DriverFoodProfile | null;
  onSave: (profile: {
    diet_type: string;
    allergies: string[];
    restrictions: string[];
    health_goals: string[];
    budget_preference: string;
  }) => Promise<void>;
  isLoading?: boolean;
}

const DIET_TYPES = [
  { value: 'none', label: 'No specific diet' },
  { value: 'vegetarian', label: 'Vegetarian' },
  { value: 'vegan', label: 'Vegan' },
  { value: 'keto', label: 'Keto/Low Carb' },
  { value: 'paleo', label: 'Paleo' },
];

const ALLERGIES = [
  'peanuts', 'tree_nuts', 'dairy', 'eggs', 'gluten', 
  'shellfish', 'fish', 'soy', 'wheat'
];

const RESTRICTIONS = [
  'no_fried', 'low_sugar', 'low_sodium', 'halal', 'kosher',
  'no_pork', 'no_beef', 'no_red_meat'
];

const HEALTH_GOALS = [
  'lose_weight', 'muscle_gain', 'more_energy', 'heart_health',
  'diabetes_management', 'general_health'
];

const BUDGETS = [
  { value: 'budget', label: 'Budget-friendly' },
  { value: 'moderate', label: 'Moderate' },
  { value: 'premium', label: 'No limit' },
];

const LABEL_MAP: Record<string, string> = {
  peanuts: 'Peanuts',
  tree_nuts: 'Tree Nuts',
  dairy: 'Dairy',
  eggs: 'Eggs',
  gluten: 'Gluten',
  shellfish: 'Shellfish',
  fish: 'Fish',
  soy: 'Soy',
  wheat: 'Wheat',
  no_fried: 'No Fried Foods',
  low_sugar: 'Low Sugar',
  low_sodium: 'Low Sodium',
  halal: 'Halal',
  kosher: 'Kosher',
  no_pork: 'No Pork',
  no_beef: 'No Beef',
  no_red_meat: 'No Red Meat',
  lose_weight: 'Lose Weight',
  muscle_gain: 'Build Muscle',
  more_energy: 'More Energy',
  heart_health: 'Heart Health',
  diabetes_management: 'Diabetes',
  general_health: 'General Health',
};

const FoodProfileForm: React.FC<FoodProfileFormProps> = ({
  profile,
  onSave,
  isLoading = false,
}) => {
  const [dietType, setDietType] = useState(profile?.diet_type || 'none');
  const [allergies, setAllergies] = useState<string[]>(profile?.allergies || []);
  const [restrictions, setRestrictions] = useState<string[]>(profile?.restrictions || []);
  const [healthGoals, setHealthGoals] = useState<string[]>(profile?.health_goals || []);
  const [budget, setBudget] = useState(profile?.budget_preference || 'moderate');

  useEffect(() => {
    if (profile) {
      setDietType(profile.diet_type || 'none');
      setAllergies(profile.allergies || []);
      setRestrictions(profile.restrictions || []);
      setHealthGoals(profile.health_goals || []);
      setBudget(profile.budget_preference || 'moderate');
    }
  }, [profile]);

  const toggleItem = (list: string[], setList: React.Dispatch<React.SetStateAction<string[]>>, item: string) => {
    setList(prev => prev.includes(item) ? prev.filter(i => i !== item) : [...prev, item]);
  };

  const handleSave = async () => {
    await onSave({
      diet_type: dietType,
      allergies,
      restrictions,
      health_goals: healthGoals,
      budget_preference: budget,
    });
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Utensils className="w-5 h-5 text-primary" />
          Food Preferences
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Diet Type */}
        <div className="space-y-3">
          <Label className="font-medium">Diet Type</Label>
          <RadioGroup value={dietType} onValueChange={setDietType} className="space-y-2">
            {DIET_TYPES.map(diet => (
              <div key={diet.value} className="flex items-center space-x-2">
                <RadioGroupItem value={diet.value} id={diet.value} />
                <Label htmlFor={diet.value}>{diet.label}</Label>
              </div>
            ))}
          </RadioGroup>
        </div>

        {/* Allergies */}
        <div className="space-y-2">
          <Label className="font-medium text-destructive">Allergies (Hard Block)</Label>
          <p className="text-xs text-muted-foreground">AI will never recommend items with these</p>
          <div className="flex flex-wrap gap-2 mt-2">
            {ALLERGIES.map(allergy => (
              <Badge
                key={allergy}
                variant={allergies.includes(allergy) ? "destructive" : "outline"}
                className={cn("cursor-pointer transition-all")}
                onClick={() => toggleItem(allergies, setAllergies, allergy)}
              >
                {LABEL_MAP[allergy] || allergy}
              </Badge>
            ))}
          </div>
        </div>

        {/* Restrictions */}
        <div className="space-y-2">
          <Label className="font-medium">Dietary Restrictions</Label>
          <div className="flex flex-wrap gap-2">
            {RESTRICTIONS.map(restriction => (
              <Badge
                key={restriction}
                variant={restrictions.includes(restriction) ? "secondary" : "outline"}
                className={cn(
                  "cursor-pointer transition-all",
                  restrictions.includes(restriction) && "bg-secondary"
                )}
                onClick={() => toggleItem(restrictions, setRestrictions, restriction)}
              >
                {LABEL_MAP[restriction] || restriction}
              </Badge>
            ))}
          </div>
        </div>

        {/* Health Goals */}
        <div className="space-y-2">
          <Label className="font-medium">Health Goals</Label>
          <div className="flex flex-wrap gap-2">
            {HEALTH_GOALS.map(goal => (
              <Badge
                key={goal}
                variant={healthGoals.includes(goal) ? "default" : "outline"}
                className={cn(
                  "cursor-pointer transition-all",
                  healthGoals.includes(goal) && "bg-primary"
                )}
                onClick={() => toggleItem(healthGoals, setHealthGoals, goal)}
              >
                {LABEL_MAP[goal] || goal}
              </Badge>
            ))}
          </div>
        </div>

        {/* Budget */}
        <div className="space-y-3">
          <Label className="font-medium">Budget Preference</Label>
          <RadioGroup value={budget} onValueChange={setBudget} className="flex gap-4">
            {BUDGETS.map(b => (
              <div key={b.value} className="flex items-center space-x-2">
                <RadioGroupItem value={b.value} id={`budget-${b.value}`} />
                <Label htmlFor={`budget-${b.value}`}>{b.label}</Label>
              </div>
            ))}
          </RadioGroup>
        </div>

        {/* Save Button */}
        <Button onClick={handleSave} disabled={isLoading} className="w-full">
          {isLoading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="w-4 h-4 mr-2" />
              Save Preferences
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
};

export default FoodProfileForm;
