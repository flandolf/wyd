import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog"
import { Button } from "./ui/button"
import { Input } from "./ui/input"
import { SubjectData } from './SubjectItem'
import { IconPicker } from './IconPicker'
import { CategoryManager } from './CategoryManager'
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs"

interface EditSubjectModalProps {
  subject: SubjectData | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSave: (id: string, updates: Partial<SubjectData>) => void
  categories: string[]
  onUpdateCategories: (categories: string[]) => void
}

export function EditSubjectModal({
  subject,
  open,
  onOpenChange,
  onSave,
  categories,
  onUpdateCategories
}: EditSubjectModalProps) {
  const [title, setTitle] = useState('')
  const [color, setColor] = useState('#22c55e')
  const [icon, setIcon] = useState('Book')
  const [category, setCategory] = useState('')
  const [dailyGoalMs, setDailyGoalMs] = useState(0)

  useEffect(() => {
    if (subject) {
      setTitle(subject.title)
      setColor(subject.color || '#22c55e')
      setIcon(subject.icon || 'Book')
      setCategory(subject.category || '')
      setDailyGoalMs(subject.dailyGoalMs || 0)
    }
  }, [subject])

  const handleSave = () => {
    if (!subject) return
    onSave(subject.id, {
      title,
      color,
      icon,
      category: category || undefined,
      dailyGoalMs
    })
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Subject</DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="appearance" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="appearance">Appearance</TabsTrigger>
            <TabsTrigger value="goals">Goals & Category</TabsTrigger>
          </TabsList>

          <TabsContent value="appearance" className="space-y-4 pt-4">
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Title</label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>

            <div className="flex gap-4">
              <div className="space-y-2 flex-1">
                <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Color</label>
                <div className="flex gap-2 flex-wrap">
                  {['#ef4444', '#f97316', '#eab308', '#22c55e', '#0ea5e9', '#3b82f6', '#a855f7', '#ec4899'].map(c => (
                    <button
                      key={c}
                      className={`w-6 h-6 rounded-full transition-all ${color === c ? 'ring-2 ring-primary ring-offset-2 scale-110' : ''}`}
                      style={{ backgroundColor: c }}
                      onClick={() => setColor(c)}
                    />
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Icon</label>
                <IconPicker selectedIcon={icon} onSelect={setIcon} color={color} />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="goals" className="space-y-4 pt-4">
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Daily Goal (Hours)</label>
              <Input
                type="number"
                value={dailyGoalMs / 3600000}
                onChange={(e) => setDailyGoalMs(Number(e.target.value) * 3600000)}
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Category</label>
              <select
                className="w-full h-10 px-3 bg-muted rounded-md text-sm"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              >
                <option value="">None</option>
                {categories.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Manage Categories</label>
              <CategoryManager categories={categories} onUpdateCategories={onUpdateCategories} />
            </div>
          </TabsContent>
        </Tabs>

        <div className="flex justify-end gap-3 mt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave}>Save Changes</Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
