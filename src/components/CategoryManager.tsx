import { useState } from 'react'
import { Plus, X, Tag } from 'lucide-react'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Badge } from './ui/badge'

interface CategoryManagerProps {
  categories: string[]
  onUpdateCategories: (categories: string[]) => void
}

export function CategoryManager({ categories, onUpdateCategories }: CategoryManagerProps) {
  const [newCategory, setNewCategory] = useState('')

  const handleAdd = () => {
    if (newCategory.trim() && !categories.includes(newCategory.trim())) {
      onUpdateCategories([...categories, newCategory.trim()])
      setNewCategory('')
    }
  }

  const handleRemove = (cat: string) => {
    onUpdateCategories(categories.filter(c => c !== cat))
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Input
          value={newCategory}
          onChange={(e) => setNewCategory(e.target.value)}
          placeholder="New category..."
          className="h-9"
          onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
        />
        <Button size="sm" onClick={handleAdd} disabled={!newCategory.trim()}>
          <Plus className="w-4 h-4" />
        </Button>
      </div>

      <div className="flex flex-wrap gap-2">
        {categories.map((cat) => (
          <Badge key={cat} variant="secondary" className="pl-2 pr-1 py-1 flex items-center gap-1 group">
            <Tag className="w-3 h-3 text-muted-foreground" />
            {cat}
            <button
              onClick={() => handleRemove(cat)}
              className="ml-1 p-0.5 rounded-full hover:bg-muted-foreground/20 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <X className="w-3 h-3" />
            </button>
          </Badge>
        ))}
      </div>
    </div>
  )
}
