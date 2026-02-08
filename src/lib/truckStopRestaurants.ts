/**
 * Known restaurants attached to major truck stop brands.
 * Used by FoodSuggestionPrompt to provide restaurant-specific
 * food recommendations without relying on POI search APIs
 * (which intentionally block restaurant results).
 */

// Brand → commonly attached restaurant chains
const BRAND_RESTAURANTS: Record<string, string[]> = {
  // Love's Travel Stops
  "love's": ["Subway", "Chester's Chicken", "Godfather's Pizza", "Arby's", "Hardee's", "Carl's Jr."],
  "loves": ["Subway", "Chester's Chicken", "Godfather's Pizza", "Arby's", "Hardee's", "Carl's Jr."],

  // Pilot / Flying J
  "pilot": ["Wendy's", "Subway", "Denny's", "Cinnabon", "Arby's", "Taco Bell"],
  "flying j": ["Wendy's", "Subway", "Denny's", "Cinnabon", "Arby's", "Taco Bell"],

  // TA (TravelCenters of America)
  "ta": ["Iron Skillet", "Burger King", "Popeyes", "Pizza Hut", "Starbucks"],
  "travelcenters": ["Iron Skillet", "Burger King", "Popeyes", "Pizza Hut", "Starbucks"],

  // Petro Stopping Centers
  "petro": ["Iron Skillet", "Country Pride", "Burger King", "Popeyes", "Pizza Hut"],

  // Sapp Bros
  "sapp": ["Subway", "Godfather's Pizza"],

  // Buc-ee's
  "buc-ee": ["Buc-ee's BBQ", "Buc-ee's Deli", "Buc-ee's Bakery"],
  "bucee": ["Buc-ee's BBQ", "Buc-ee's Deli", "Buc-ee's Bakery"],

  // Boss Truck Shop
  "boss truck": ["Naf Naf Grill", "Subway"],
  "boss shop": ["Naf Naf Grill", "Subway"],

  // Road Ranger
  "road ranger": ["Subway", "Taco Bell"],

  // Roady's
  "roady": ["Subway"],

  // AmBest
  "ambest": ["Subway"],

  // One9
  "one9": ["Subway"],
  "one 9": ["Subway"],

  // Iowa 80
  "iowa 80": ["Iowa 80 Kitchen", "Wendy's", "Dairy Queen", "Taco Bell"],

  // Kenly 95
  "kenly 95": ["Subway", "Bojangles"],
};

/**
 * Get known restaurant names for a truck stop based on its brand and name.
 * Returns an empty array if no known restaurants are mapped.
 */
export function getRestaurantsForBrand(stopName: string, brand?: string): string[] {
  const searchTexts = [
    (brand || '').toLowerCase(),
    (stopName || '').toLowerCase(),
  ];

  for (const text of searchTexts) {
    if (!text) continue;
    for (const [key, restaurants] of Object.entries(BRAND_RESTAURANTS)) {
      if (text.includes(key)) {
        return restaurants;
      }
    }
  }

  return [];
}
