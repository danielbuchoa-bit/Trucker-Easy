import { useState } from 'react';
import { useLanguage } from '@/i18n/LanguageContext';
import { useNavigate, useParams } from 'react-router-dom';
import { 
  ArrowLeft, Star, MapPin, Clock, Phone, Navigation, 
  ParkingSquare, Fuel, Droplets, Coffee, Scale, Wifi,
  ThumbsUp, ThumbsDown, MessageSquare, Flag, Building2
} from 'lucide-react';
import { toast } from 'sonner';

const PlaceDetailScreen = () => {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const { id } = useParams();
  const [activeTab, setActiveTab] = useState('info');
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [rating, setRating] = useState(0);
  const [reviewText, setReviewText] = useState('');

  // Mock place data
  const place = {
    id,
    name: 'Pilot Travel Center',
    type: 'truckStop',
    address: '1234 Highway 40, Oklahoma City, OK 73108',
    phone: '(405) 555-0123',
    distance: '0.5 mi',
    rating: 4.2,
    reviewCount: 128,
    parking: 'available',
    parkingSpots: { total: 150, available: 42 },
    isOpen: true,
    hours: '24 Hours',
    amenities: [
      { id: 'fuel', icon: Fuel, label: 'Diesel' },
      { id: 'parking', icon: ParkingSquare, label: 'Truck Parking' },
      { id: 'shower', icon: Droplets, label: 'Showers' },
      { id: 'food', icon: Coffee, label: 'Restaurant' },
      { id: 'scales', icon: Scale, label: 'CAT Scales' },
      { id: 'wifi', icon: Wifi, label: 'Free WiFi' },
    ],
    lastUpdate: '5 min ago',
    updatedBy: 'TruckerMike',
  };

  const reviews = [
    {
      id: '1',
      user: 'BigRigBob',
      rating: 5,
      date: '2 days ago',
      text: 'Great stop! Clean showers, friendly staff, and plenty of parking even at night.',
      helpful: 12,
    },
    {
      id: '2',
      user: 'HighwayQueen',
      rating: 4,
      date: '1 week ago',
      text: 'Good food at the restaurant. Parking was a bit tight when I arrived around 8pm.',
      helpful: 8,
    },
    {
      id: '3',
      user: 'OTRVeteran',
      rating: 3,
      date: '2 weeks ago',
      text: 'Fuel prices are a bit high compared to other stops nearby. Otherwise decent.',
      helpful: 5,
    },
  ];

  // Mock company data for shippers/receivers
  const companyReviews = [
    {
      id: '1',
      company: 'ABC Distribution',
      rating: 4.5,
      waitTime: '30 min',
      service: 'Excellent',
      facilities: 'Good',
      reviews: 45,
    },
  ];

  const tabs = [
    { id: 'info', label: t.place.info },
    { id: 'reviews', label: `${t.place.reviews} (${place.reviewCount})` },
    { id: 'reports', label: t.place.reports },
  ];

  const getParkingColor = (status: string) => {
    switch (status) {
      case 'available': return 'text-parking-available';
      case 'limited': return 'text-parking-limited';
      case 'full': return 'text-parking-full';
      default: return 'text-status-unknown';
    }
  };

  const handleSubmitReview = () => {
    if (rating === 0) {
      toast.error('Please select a rating');
      return;
    }
    toast.success(t.reviews.thankYou);
    setShowReviewForm(false);
    setRating(0);
    setReviewText('');
  };

  return (
    <div className="min-h-screen bg-background pb-6">
      {/* Header Image Placeholder */}
      <div className="relative h-48 bg-gradient-to-b from-primary/30 to-background">
        <button
          onClick={() => navigate(-1)}
          className="absolute top-4 left-4 safe-top w-10 h-10 bg-background/80 backdrop-blur-sm rounded-full flex items-center justify-center"
        >
          <ArrowLeft className="w-5 h-5 text-foreground" />
        </button>
        
        <button
          onClick={() => {}}
          className="absolute top-4 right-4 safe-top w-10 h-10 bg-primary rounded-full flex items-center justify-center"
        >
          <Navigation className="w-5 h-5 text-primary-foreground" />
        </button>
      </div>

      {/* Place Info */}
      <div className="px-4 -mt-8 relative z-10">
        <div className="bg-card rounded-xl border border-border p-4">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <h1 className="text-xl font-bold text-foreground">{place.name}</h1>
              <div className="flex items-center gap-2 mt-1">
                <div className="flex items-center gap-1">
                  <Star className="w-4 h-4 text-primary fill-primary" />
                  <span className="font-medium text-foreground">{place.rating}</span>
                </div>
                <span className="text-muted-foreground">•</span>
                <span className="text-sm text-muted-foreground">{place.reviewCount} reviews</span>
              </div>
            </div>
            
            <div className={`px-3 py-1 rounded-full text-sm font-medium ${place.isOpen ? 'bg-status-open/20 text-status-open' : 'bg-status-closed/20 text-status-closed'}`}>
              {place.isOpen ? 'Open' : 'Closed'}
            </div>
          </div>

          <div className="flex items-center gap-2 mt-3 text-sm text-muted-foreground">
            <MapPin className="w-4 h-4" />
            <span>{place.address}</span>
          </div>
          
          <div className="flex items-center gap-2 mt-2 text-sm text-muted-foreground">
            <Clock className="w-4 h-4" />
            <span>{place.hours}</span>
          </div>
          
          <div className="flex items-center gap-2 mt-2 text-sm text-muted-foreground">
            <Phone className="w-4 h-4" />
            <span>{place.phone}</span>
          </div>

          {/* Parking Status */}
          <div className="mt-4 p-3 bg-secondary/50 rounded-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ParkingSquare className={`w-5 h-5 ${getParkingColor(place.parking)}`} />
                <span className="font-medium text-foreground">Parking</span>
              </div>
              <span className={`font-bold ${getParkingColor(place.parking)}`}>
                {place.parkingSpots.available} / {place.parkingSpots.total} spots
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Updated {place.lastUpdate} by {place.updatedBy}
            </p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 px-4 mt-4">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 py-3 text-sm font-medium rounded-lg transition-all ${
              activeTab === tab.id
                ? 'bg-primary text-primary-foreground'
                : 'bg-card text-muted-foreground hover:text-foreground'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="px-4 mt-4">
        {activeTab === 'info' && (
          <div className="space-y-4">
            {/* Amenities */}
            <div className="bg-card rounded-xl border border-border p-4">
              <h3 className="font-semibold text-foreground mb-3">Amenities</h3>
              <div className="grid grid-cols-3 gap-3">
                {place.amenities.map((amenity) => {
                  const Icon = amenity.icon;
                  return (
                    <div key={amenity.id} className="flex flex-col items-center gap-2 p-3 bg-secondary/50 rounded-lg">
                      <Icon className="w-5 h-5 text-primary" />
                      <span className="text-xs text-muted-foreground text-center">{amenity.label}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Quick Report */}
            <div className="bg-card rounded-xl border border-border p-4">
              <h3 className="font-semibold text-foreground mb-3">{t.report.quickReport}</h3>
              <div className="flex gap-2">
                <button 
                  onClick={() => toast.success(t.report.thanks)}
                  className="flex-1 py-3 bg-parking-available/20 text-parking-available rounded-lg font-medium"
                >
                  {t.place.available}
                </button>
                <button 
                  onClick={() => toast.success(t.report.thanks)}
                  className="flex-1 py-3 bg-parking-limited/20 text-parking-limited rounded-lg font-medium"
                >
                  {t.place.limited}
                </button>
                <button 
                  onClick={() => toast.success(t.report.thanks)}
                  className="flex-1 py-3 bg-parking-full/20 text-parking-full rounded-lg font-medium"
                >
                  {t.place.full}
                </button>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'reviews' && (
          <div className="space-y-4">
            {/* Write Review Button */}
            {!showReviewForm ? (
              <button
                onClick={() => setShowReviewForm(true)}
                className="w-full py-4 bg-primary text-primary-foreground rounded-xl font-semibold"
              >
                {t.reviews.writeReview}
              </button>
            ) : (
              <div className="bg-card rounded-xl border border-border p-4">
                <h3 className="font-semibold text-foreground mb-3">{t.reviews.writeReview}</h3>
                
                {/* Star Rating */}
                <div className="flex gap-2 mb-4">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      onClick={() => setRating(star)}
                      className="p-1"
                    >
                      <Star 
                        className={`w-8 h-8 ${star <= rating ? 'text-primary fill-primary' : 'text-muted-foreground'}`} 
                      />
                    </button>
                  ))}
                </div>
                
                <textarea
                  value={reviewText}
                  onChange={(e) => setReviewText(e.target.value)}
                  placeholder={t.reviews.shareFeedback}
                  className="w-full h-24 p-3 bg-secondary/50 border border-border rounded-lg text-foreground placeholder:text-muted-foreground resize-none focus:outline-none focus:ring-2 focus:ring-primary"
                />
                
                <div className="flex gap-2 mt-3">
                  <button
                    onClick={() => setShowReviewForm(false)}
                    className="flex-1 py-3 bg-secondary text-foreground rounded-lg font-medium"
                  >
                    {t.common.cancel}
                  </button>
                  <button
                    onClick={handleSubmitReview}
                    className="flex-1 py-3 bg-primary text-primary-foreground rounded-lg font-medium"
                  >
                    {t.reviews.submit}
                  </button>
                </div>
              </div>
            )}

            {/* Reviews List */}
            {reviews.map((review) => (
              <div key={review.id} className="bg-card rounded-xl border border-border p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold text-primary">
                      {review.user[0]}
                    </div>
                    <span className="font-medium text-foreground">{review.user}</span>
                  </div>
                  <span className="text-sm text-muted-foreground">{review.date}</span>
                </div>
                
                <div className="flex items-center gap-1 mb-2">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Star
                      key={star}
                      className={`w-4 h-4 ${star <= review.rating ? 'text-primary fill-primary' : 'text-muted-foreground'}`}
                    />
                  ))}
                </div>
                
                <p className="text-sm text-foreground">{review.text}</p>
                
                <div className="flex items-center gap-4 mt-3">
                  <button className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
                    <ThumbsUp className="w-4 h-4" />
                    <span>{review.helpful}</span>
                  </button>
                  <button className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
                    <Flag className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'reports' && (
          <div className="space-y-4">
            {/* Company Rating Section */}
            <div className="bg-card rounded-xl border border-border p-4">
              <div className="flex items-center gap-2 mb-4">
                <Building2 className="w-5 h-5 text-primary" />
                <h3 className="font-semibold text-foreground">{t.reviews.companyRating}</h3>
              </div>
              
              <p className="text-sm text-muted-foreground mb-4">
                {t.reviews.rateShipper}
              </p>
              
              <button
                onClick={() => navigate(`/company-review/${id}`)}
                className="w-full py-3 bg-primary text-primary-foreground rounded-lg font-medium"
              >
                {t.reviews.rateCompany}
              </button>
            </div>

            {/* Recent Reports */}
            <div className="bg-card rounded-xl border border-border p-4">
              <h3 className="font-semibold text-foreground mb-3">{t.place.recentReports}</h3>
              
              <div className="space-y-3">
                <div className="flex items-center justify-between py-2 border-b border-border">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-parking-available" />
                    <span className="text-sm text-foreground">Parking Available</span>
                  </div>
                  <span className="text-xs text-muted-foreground">5 min ago</span>
                </div>
                <div className="flex items-center justify-between py-2 border-b border-border">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-parking-limited" />
                    <span className="text-sm text-foreground">Parking Limited</span>
                  </div>
                  <span className="text-xs text-muted-foreground">25 min ago</span>
                </div>
                <div className="flex items-center justify-between py-2">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-parking-available" />
                    <span className="text-sm text-foreground">Parking Available</span>
                  </div>
                  <span className="text-xs text-muted-foreground">1 hour ago</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PlaceDetailScreen;
