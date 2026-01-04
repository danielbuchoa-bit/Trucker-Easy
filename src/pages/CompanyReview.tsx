import { useState } from 'react';
import { useLanguage } from '@/i18n/LanguageContext';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Star, Clock, Users, Warehouse, Truck, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';

const CompanyReviewScreen = () => {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const { id } = useParams();
  
  const [companyName, setCompanyName] = useState('');
  const [overallRating, setOverallRating] = useState(0);
  const [waitTime, setWaitTime] = useState('');
  const [ratings, setRatings] = useState({
    service: 0,
    organization: 0,
    facilities: 0,
    loading: 0,
  });
  const [tags, setTags] = useState<string[]>([]);
  const [notes, setNotes] = useState('');

  const waitTimeOptions = [
    { id: 'under30', label: '< 30 min' },
    { id: '30to60', label: '30-60 min' },
    { id: '1to2h', label: '1-2 hours' },
    { id: '2to4h', label: '2-4 hours' },
    { id: 'over4h', label: '4+ hours' },
  ];

  const tagOptions = [
    { id: 'friendly', label: t.reviews.tags.friendly },
    { id: 'organized', label: t.reviews.tags.organized },
    { id: 'clean', label: t.reviews.tags.clean },
    { id: 'quickLoad', label: t.reviews.tags.quickLoad },
    { id: 'goodRestrooms', label: t.reviews.tags.goodRestrooms },
    { id: 'safeParking', label: t.reviews.tags.safeParking },
    { id: 'slowProcess', label: t.reviews.tags.slowProcess },
    { id: 'rude', label: t.reviews.tags.rude },
    { id: 'disorganized', label: t.reviews.tags.disorganized },
    { id: 'noRestrooms', label: t.reviews.tags.noRestrooms },
  ];

  const ratingCategories = [
    { id: 'service', label: t.reviews.categories.service, icon: Users },
    { id: 'organization', label: t.reviews.categories.organization, icon: Warehouse },
    { id: 'facilities', label: t.reviews.categories.facilities, icon: Truck },
    { id: 'loading', label: t.reviews.categories.loading, icon: Clock },
  ];

  const toggleTag = (tagId: string) => {
    setTags(prev => 
      prev.includes(tagId) 
        ? prev.filter(t => t !== tagId)
        : [...prev, tagId]
    );
  };

  const handleSubmit = () => {
    if (!companyName.trim()) {
      toast.error('Please enter company name');
      return;
    }
    if (overallRating === 0) {
      toast.error('Please select overall rating');
      return;
    }
    
    toast.success(t.reviews.thankYou);
    navigate(-1);
  };

  return (
    <div className="min-h-screen bg-background pb-6">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-background/95 backdrop-blur-sm border-b border-border safe-top">
        <div className="flex items-center gap-4 p-4">
          <button
            onClick={() => navigate(-1)}
            className="w-10 h-10 bg-card border border-border rounded-full flex items-center justify-center"
          >
            <ArrowLeft className="w-5 h-5 text-foreground" />
          </button>
          <div>
            <h1 className="text-lg font-bold text-foreground">{t.reviews.rateCompany}</h1>
            <p className="text-sm text-muted-foreground">{t.reviews.shipperReceiver}</p>
          </div>
        </div>
      </div>

      <div className="p-4 space-y-6">
        {/* Company Name */}
        <div className="bg-card rounded-xl border border-border p-4">
          <label className="block text-sm font-medium text-foreground mb-2">
            {t.reviews.companyName}
          </label>
          <input
            type="text"
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
            placeholder={t.reviews.enterCompanyName}
            className="w-full h-12 px-4 bg-secondary/50 border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>

        {/* Overall Rating */}
        <div className="bg-card rounded-xl border border-border p-4">
          <label className="block text-sm font-medium text-foreground mb-3">
            {t.reviews.overallRating}
          </label>
          <div className="flex justify-center gap-3">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                onClick={() => setOverallRating(star)}
                className="p-1"
              >
                <Star 
                  className={`w-10 h-10 ${star <= overallRating ? 'text-primary fill-primary' : 'text-muted-foreground'}`} 
                />
              </button>
            ))}
          </div>
        </div>

        {/* Wait Time */}
        <div className="bg-card rounded-xl border border-border p-4">
          <label className="block text-sm font-medium text-foreground mb-3">
            {t.reviews.waitTime}
          </label>
          <div className="flex flex-wrap gap-2">
            {waitTimeOptions.map((option) => (
              <button
                key={option.id}
                onClick={() => setWaitTime(option.id)}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                  waitTime === option.id
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-secondary text-foreground hover:bg-secondary/80'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        {/* Category Ratings */}
        <div className="bg-card rounded-xl border border-border p-4">
          <label className="block text-sm font-medium text-foreground mb-3">
            {t.reviews.detailedRatings}
          </label>
          <div className="space-y-4">
            {ratingCategories.map((category) => {
              const Icon = category.icon;
              return (
                <div key={category.id} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Icon className="w-5 h-5 text-muted-foreground" />
                    <span className="text-sm text-foreground">{category.label}</span>
                  </div>
                  <div className="flex gap-1">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        onClick={() => setRatings(prev => ({ ...prev, [category.id]: star }))}
                        className="p-0.5"
                      >
                        <Star 
                          className={`w-5 h-5 ${star <= ratings[category.id as keyof typeof ratings] ? 'text-primary fill-primary' : 'text-muted-foreground'}`} 
                        />
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Tags */}
        <div className="bg-card rounded-xl border border-border p-4">
          <label className="block text-sm font-medium text-foreground mb-3">
            {t.reviews.selectTags}
          </label>
          <div className="flex flex-wrap gap-2">
            {tagOptions.map((tag) => (
              <button
                key={tag.id}
                onClick={() => toggleTag(tag.id)}
                className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all flex items-center gap-1 ${
                  tags.includes(tag.id)
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-secondary text-foreground hover:bg-secondary/80'
                }`}
              >
                {tags.includes(tag.id) && <CheckCircle className="w-3.5 h-3.5" />}
                {tag.label}
              </button>
            ))}
          </div>
        </div>

        {/* Additional Notes */}
        <div className="bg-card rounded-xl border border-border p-4">
          <label className="block text-sm font-medium text-foreground mb-2">
            {t.reviews.additionalNotes}
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder={t.reviews.shareExperience}
            className="w-full h-24 p-3 bg-secondary/50 border border-border rounded-lg text-foreground placeholder:text-muted-foreground resize-none focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>

        {/* Submit Button */}
        <button
          onClick={handleSubmit}
          className="w-full h-14 bg-primary text-primary-foreground rounded-xl font-semibold text-lg"
        >
          {t.reviews.submitReview}
        </button>
      </div>
    </div>
  );
};

export default CompanyReviewScreen;
