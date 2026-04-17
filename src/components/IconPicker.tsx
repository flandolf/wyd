import * as Icons from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover'
import { Button } from './ui/button'
import { cn } from '../lib/utils'

const ICON_LIST = [
  'Book', 'Code', 'PenTool', 'Languages', 'Music', 'Briefcase', 'GraduationCap',
  'Calculator', 'FlaskConical', 'Palette', 'Dumbbell', 'Gamepad2', 'Heart',
  'Globe', 'Coffee', 'Timer', 'Star', 'Zap', 'Target', 'Smile'
]

interface IconPickerProps {
  selectedIcon?: string
  onSelect: (icon: string) => void
  color: string
}

export function IconPicker({ selectedIcon, onSelect, color }: IconPickerProps) {
  const IconComponent = selectedIcon && (Icons as any)[selectedIcon] ? (Icons as any)[selectedIcon] : Icons.HelpCircle

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          className="w-10 h-10 rounded-xl"
          style={{ color: color, borderColor: `${color}40` }}
        >
          <IconComponent className="w-5 h-5" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-2">
        <div className="grid grid-cols-5 gap-1">
          {ICON_LIST.map((iconName) => {
            const Icon = (Icons as any)[iconName]
            return (
              <Button
                key={iconName}
                variant="ghost"
                size="icon"
                className={cn(
                  "w-10 h-10 rounded-lg",
                  selectedIcon === iconName && "bg-muted"
                )}
                onClick={() => onSelect(iconName)}
              >
                <Icon className="w-5 h-5" />
              </Button>
            )
          })}
        </div>
      </PopoverContent>
    </Popover>
  )
}
