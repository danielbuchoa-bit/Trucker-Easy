import { useState } from 'react';
import { useLanguage } from '@/i18n/LanguageContext';
import { ArrowLeft, ArrowRight, Check, Truck, Heart } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';

interface OnboardingScreenProps {
  onComplete: () => void;
  onBack: () => void;
}

const OnboardingScreen = ({ onComplete, onBack }: OnboardingScreenProps) => {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [truckType, setTruckType] = useState('');
  const [trailerType, setTrailerType] = useState('');
  const [dietPrefs, setDietPrefs] = useState<string[]>([]);
  const [allergies, setAllergies] = useState<string[]>([]);
  const [healthConditions, setHealthConditions] = useState<string[]>([]);
  const [fitnessGoals, setFitnessGoals] = useState<string[]>([]);

  const totalSteps = 3;

  const truckOptions = [
    { id: 'semi', label: t.truckTypes.semi, icon: '🚛' },
    { id: 'daycab', label: t.truckTypes.daycab, icon: '🚚' },
    { id: 'sleeper', label: t.truckTypes.sleeper, icon: '🛏️' },
    { id: 'boxtruck', label: t.truckTypes.boxtruck, icon: '📦' },
    { id: 'flatbed', label: t.truckTypes.flatbed, icon: '🏗️' },
  ];

  const trailerOptions = [
    { id: 'dryvan', label: t.trailerTypes.dryvan, icon: '📦' },
    { id: 'reefer', label: t.trailerTypes.reefer, icon: '❄️' },
    { id: 'flatbed', label: t.trailerTypes.flatbed, icon: '🏗️' },
    { id: 'tanker', label: t.trailerTypes.tanker, icon: '🛢️' },
    { id: 'container', label: t.trailerTypes.container, icon: '🚢' },
    { id: 'lowboy', label: t.trailerTypes.lowboy, icon: '🏎️' },
    { id: 'none', label: t.trailerTypes.none, icon: '❌' },
  ];

  const dietOptions = [
    { id: 'none', label: t.diet.none },
    { id: 'vegetarian', label: t.diet.vegetarian },
    { id: 'vegan', label: t.diet.vegan },
    { id: 'keto', label: t.diet.keto },
    { id: 'lowCarb', label: t.diet.lowCarb },
    { id: 'glutenFree', label: t.diet.glutenFree },
    { id: 'dairyFree', label: t.diet.dairyFree },
    { id: 'halal', label: t.diet.halal },
    { id: 'kosher', label: t.diet.kosher },
  ];

  const allergyOptions = [
    { id: 'nuts', label: t.allergies.nuts },
    { id: 'shellfish', label: t.allergies.shellfish },
    { id: 'dairy', label: t.allergies.dairy },
    { id: 'eggs', label: t.allergies.eggs },
    { id: 'soy', label: t.allergies.soy },
    { id: 'wheat', label: t.allergies.wheat },
    { id: 'fish', label: t.allergies.fish },
  ];

  const healthOptions = [
    { id: 'none', label: t.health.none },
    { id: 'diabetes', label: t.health.diabetes },
    { id: 'hypertension', label: t.health.hypertension },
    { id: 'heartDisease', label: t.health.heartDisease },
    { id: 'highCholesterol', label: t.health.highCholesterol },
  ];

  const goalOptions = [
    { id: 'loseWeight', label: t.goals.loseWeight },
    { id: 'gainMuscle', label: t.goals.gainMuscle },
    { id: 'maintain', label: t.goals.maintain },
    { id: 'eatHealthier', label: t.goals.eatHealthier },
    { id: 'moreEnergy', label: t.goals.moreEnergy },
  ];

  const toggleArrayItem = (arr: string[], setArr: (val: string[]) => void, item: string) => {
    if (arr.includes(item)) {
      setArr(arr.filter((i) => i !== item));
    } else {
      setArr([...arr, item]);
    }
  };

  const handleNext = () => {
    if (step < totalSteps - 1) {
      setStep(step + 1);
    } else {
      onComplete();
      navigate('/home');
    }
  };

  const handleBack = () => {
    if (step > 0) {
      setStep(step - 1);
    } else {
      onBack();
      navigate('/auth');
    }
  };

  const handleSkip = () => {
    onComplete();
    navigate('/home');
  };

  const renderStep = () => {
    switch (step) {
      case 0:
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold mb-3">{t.onboarding.selectTruck}</h3>
              <div className="grid grid-cols-2 gap-3">
                {truckOptions.map((option) => (
                  <button
                    key={option.id}
                    onClick={() => setTruckType(option.id)}
                    className={cn(
                      'flex flex-col items-center justify-center p-4 rounded-xl border-2 transition-all',
                      truckType === option.id
                        ? 'border-primary bg-primary/10'
                        : 'border-border bg-card hover:border-primary/50'
                    )}
                  >
                    <span className="text-3xl mb-2">{option.icon}</span>
                    <span className="text-sm font-medium text-center">{option.label}</span>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <h3 className="text-lg font-semibold mb-3">{t.onboarding.selectTrailer}</h3>
              <div className="grid grid-cols-3 gap-2">
                {trailerOptions.map((option) => (
                  <button
                    key={option.id}
                    onClick={() => setTrailerType(option.id)}
                    className={cn(
                      'flex flex-col items-center justify-center p-3 rounded-xl border-2 transition-all',
                      trailerType === option.id
                        ? 'border-primary bg-primary/10'
                        : 'border-border bg-card hover:border-primary/50'
                    )}
                  >
                    <span className="text-2xl mb-1">{option.icon}</span>
                    <span className="text-xs font-medium text-center">{option.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        );

      case 1:
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold mb-3">{t.onboarding.dietaryPreferences}</h3>
              <div className="flex flex-wrap gap-2">
                {dietOptions.map((option) => (
                  <button
                    key={option.id}
                    onClick={() => toggleArrayItem(dietPrefs, setDietPrefs, option.id)}
                    className={cn(
                      'px-4 py-2 rounded-full border-2 text-sm font-medium transition-all',
                      dietPrefs.includes(option.id)
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border bg-card hover:border-primary/50'
                    )}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <h3 className="text-lg font-semibold mb-3">{t.onboarding.allergies}</h3>
              <div className="flex flex-wrap gap-2">
                {allergyOptions.map((option) => (
                  <button
                    key={option.id}
                    onClick={() => toggleArrayItem(allergies, setAllergies, option.id)}
                    className={cn(
                      'px-4 py-2 rounded-full border-2 text-sm font-medium transition-all',
                      allergies.includes(option.id)
                        ? 'border-destructive bg-destructive/10 text-destructive'
                        : 'border-border bg-card hover:border-destructive/50'
                    )}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        );

      case 2:
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold mb-3">
                {t.onboarding.healthConditions} {t.onboarding.optional}
              </h3>
              <div className="flex flex-wrap gap-2">
                {healthOptions.map((option) => (
                  <button
                    key={option.id}
                    onClick={() => toggleArrayItem(healthConditions, setHealthConditions, option.id)}
                    className={cn(
                      'px-4 py-2 rounded-full border-2 text-sm font-medium transition-all',
                      healthConditions.includes(option.id)
                        ? 'border-info bg-info/10 text-info'
                        : 'border-border bg-card hover:border-info/50'
                    )}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <h3 className="text-lg font-semibold mb-3">{t.onboarding.fitnessGoals}</h3>
              <div className="flex flex-wrap gap-2">
                {goalOptions.map((option) => (
                  <button
                    key={option.id}
                    onClick={() => toggleArrayItem(fitnessGoals, setFitnessGoals, option.id)}
                    className={cn(
                      'px-4 py-2 rounded-full border-2 text-sm font-medium transition-all',
                      fitnessGoals.includes(option.id)
                        ? 'border-success bg-success/10 text-success'
                        : 'border-border bg-card hover:border-success/50'
                    )}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Header */}
      <div className="p-4 safe-top flex items-center justify-between">
        <button
          onClick={handleBack}
          className="w-12 h-12 flex items-center justify-center rounded-full bg-card hover:bg-secondary transition-colors"
        >
          <ArrowLeft className="w-6 h-6" />
        </button>

        {/* Progress Dots */}
        <div className="flex gap-2">
          {Array.from({ length: totalSteps }).map((_, i) => (
            <div
              key={i}
              className={cn(
                'w-2 h-2 rounded-full transition-all',
                i === step ? 'w-6 bg-primary' : i < step ? 'bg-primary' : 'bg-border'
              )}
            />
          ))}
        </div>

        <button
          onClick={handleSkip}
          className="text-muted-foreground hover:text-foreground px-4"
        >
          {t.common.skip}
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 p-6 overflow-auto pb-32">
        {/* Step Header */}
        <div className="mb-6">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
            {step === 0 ? (
              <Truck className="w-8 h-8 text-primary" />
            ) : (
              <Heart className="w-8 h-8 text-primary" />
            )}
          </div>
          <h2 className="text-2xl font-bold">
            {step === 0 ? t.onboarding.truckType : t.onboarding.healthProfile}
          </h2>
          <p className="text-muted-foreground mt-1">
            {step === 0 ? t.onboarding.letsSetup : t.onboarding.healthSubtitle}
          </p>
        </div>

        {renderStep()}
      </div>

      {/* Bottom Button */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-background border-t border-border safe-bottom">
        <button
          onClick={handleNext}
          className="w-full py-4 bg-primary text-primary-foreground rounded-xl font-semibold text-lg flex items-center justify-center gap-2 transition-all duration-200 hover:opacity-90 active:scale-[0.98]"
        >
          {step === totalSteps - 1 ? (
            <>
              <Check className="w-5 h-5" />
              {t.common.done}
            </>
          ) : (
            <>
              {t.common.next}
              <ArrowRight className="w-5 h-5" />
            </>
          )}
        </button>
      </div>
    </div>
  );
};

export default OnboardingScreen;
