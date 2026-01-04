import { useState, useCallback } from 'react';
import { Search, MapPin, Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { HereService, GeocodeResult } from '@/services/HereService';
import { useLanguage } from '@/i18n/LanguageContext';
import { cn } from '@/lib/utils';

interface AddressSearchProps {
  placeholder?: string;
  onSelect: (result: GeocodeResult) => void;
  className?: string;
}

const AddressSearch = ({ placeholder, onSelect, className }: AddressSearchProps) => {
  const { t } = useLanguage();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<GeocodeResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [showResults, setShowResults] = useState(false);

  const searchAddress = useCallback(async (searchQuery: string) => {
    if (searchQuery.length < 3) {
      setResults([]);
      return;
    }

    setLoading(true);
    try {
      const geocodeResults = await HereService.geocode(searchQuery);
      setResults(geocodeResults);
      setShowResults(true);
    } catch (error) {
      console.error('Geocode error:', error);
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setQuery(value);
    
    // Debounce search
    const timeoutId = setTimeout(() => {
      searchAddress(value);
    }, 400);

    return () => clearTimeout(timeoutId);
  };

  const handleSelect = (result: GeocodeResult) => {
    setQuery(result.address);
    setShowResults(false);
    setResults([]);
    onSelect(result);
  };

  return (
    <div className={cn("relative", className)}>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder={placeholder || t.navigation?.searchAddress || 'Search address...'}
          value={query}
          onChange={handleInputChange}
          onFocus={() => results.length > 0 && setShowResults(true)}
          className="pl-10 pr-10"
        />
        {loading && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground animate-spin" />
        )}
      </div>

      {showResults && results.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-popover border border-border rounded-lg shadow-lg overflow-hidden">
          {results.map((result) => (
            <button
              key={result.id}
              onClick={() => handleSelect(result)}
              className="w-full flex items-start gap-3 p-3 hover:bg-accent text-left transition-colors"
            >
              <MapPin className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">{result.title}</p>
                <p className="text-xs text-muted-foreground truncate">{result.address}</p>
              </div>
            </button>
          ))}
        </div>
      )}

      {showResults && query.length >= 3 && results.length === 0 && !loading && (
        <div className="absolute z-50 w-full mt-1 bg-popover border border-border rounded-lg shadow-lg p-3">
          <p className="text-sm text-muted-foreground text-center">
            {t.navigation?.noResults || 'No results found'}
          </p>
        </div>
      )}
    </div>
  );
};

export default AddressSearch;
