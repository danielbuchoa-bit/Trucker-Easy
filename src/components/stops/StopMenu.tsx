import React, { useState } from 'react';
import { Coffee, Flame, Snowflake, Cookie, Leaf, Plus, Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { MENU_CATEGORIES, DEFAULT_MENU_ITEMS, type StopMenuItem } from '@/types/stops';
import { cn } from '@/lib/utils';

interface StopMenuProps {
  placeId: string;
  placeType: string;
  menuItems: StopMenuItem[];
  onAddItem?: (category: string, itemName: string, price?: number) => void;
  onToggleAvailable?: (itemId: string, available: boolean) => void;
  isLoading?: boolean;
}

const categoryIcons = {
  drinks: Coffee,
  hot_food: Flame,
  cold_grab_go: Snowflake,
  snacks: Cookie,
  healthy: Leaf,
};

const StopMenu: React.FC<StopMenuProps> = ({
  placeId,
  placeType,
  menuItems,
  onAddItem,
  onToggleAvailable,
  isLoading = false,
}) => {
  const [activeCategory, setActiveCategory] = useState<string>('drinks');
  const [showAddForm, setShowAddForm] = useState(false);
  const [newItemName, setNewItemName] = useState('');
  const [newItemPrice, setNewItemPrice] = useState('');

  // Merge crowd-sourced items with defaults
  const getItemsForCategory = (category: string) => {
    const crowdItems = menuItems.filter(m => m.category === category);
    const defaultItems = DEFAULT_MENU_ITEMS[category] || [];
    
    // Create a set of crowd-sourced item names for deduplication
    const crowdItemNames = new Set(crowdItems.map(i => i.item_name.toLowerCase()));
    
    // Add default items that aren't already in crowd-sourced
    const combinedItems = [
      ...crowdItems,
      ...defaultItems
        .filter(name => !crowdItemNames.has(name.toLowerCase()))
        .map(name => ({
          id: `default-${category}-${name}`,
          place_id: placeId,
          category: category as StopMenuItem['category'],
          item_name: name,
          price: undefined as number | undefined,
          available: true,
          added_by: 'system',
          upvotes: 0,
          created_at: new Date().toISOString(),
        }))
    ];
    
    return combinedItems;
  };

  const handleAddItem = () => {
    if (newItemName.trim() && onAddItem) {
      onAddItem(activeCategory, newItemName.trim(), newItemPrice ? parseFloat(newItemPrice) : undefined);
      setNewItemName('');
      setNewItemPrice('');
      setShowAddForm(false);
    }
  };

  const Icon = categoryIcons[activeCategory as keyof typeof categoryIcons] || Coffee;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Icon className="w-5 h-5 text-primary" />
          Stop Menu
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs value={activeCategory} onValueChange={setActiveCategory}>
          <TabsList className="grid grid-cols-5 mb-4">
            {Object.entries(categoryIcons).map(([key, CategoryIcon]) => (
              <TabsTrigger key={key} value={key} className="px-2">
                <CategoryIcon className="w-4 h-4" />
              </TabsTrigger>
            ))}
          </TabsList>

          {Object.keys(MENU_CATEGORIES).map(category => (
            <TabsContent key={category} value={category} className="mt-0">
              <div className="space-y-2">
                <h4 className="text-sm font-medium text-muted-foreground">
                  {MENU_CATEGORIES[category as keyof typeof MENU_CATEGORIES]}
                </h4>
                
                <div className="flex flex-wrap gap-2">
                  {getItemsForCategory(category).map(item => (
                    <Badge
                      key={item.id}
                      variant={item.available ? "secondary" : "outline"}
                      className={cn(
                        "cursor-pointer transition-all",
                        !item.available && "opacity-50 line-through"
                      )}
                      onClick={() => {
                        if (onToggleAvailable && !item.id.startsWith('default-')) {
                          onToggleAvailable(item.id, !item.available);
                        }
                      }}
                    >
                      {item.item_name}
                      {item.price && (
                        <span className="ml-1 text-xs opacity-70">${item.price.toFixed(2)}</span>
                      )}
                    </Badge>
                  ))}
                </div>

                {/* Add item form */}
                {showAddForm ? (
                  <div className="flex items-center gap-2 mt-3">
                    <Input
                      placeholder="Item name"
                      value={newItemName}
                      onChange={e => setNewItemName(e.target.value)}
                      className="flex-1"
                    />
                    <Input
                      placeholder="Price"
                      type="number"
                      step="0.01"
                      value={newItemPrice}
                      onChange={e => setNewItemPrice(e.target.value)}
                      className="w-20"
                    />
                    <Button size="icon" variant="ghost" onClick={handleAddItem}>
                      <Check className="w-4 h-4" />
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => setShowAddForm(false)}>
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                ) : (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="mt-2"
                    onClick={() => setShowAddForm(true)}
                  >
                    <Plus className="w-4 h-4 mr-1" />
                    Add item
                  </Button>
                )}
              </div>
            </TabsContent>
          ))}
        </Tabs>
      </CardContent>
    </Card>
  );
};

export default StopMenu;
