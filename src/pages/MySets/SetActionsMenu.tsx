import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import IconDots from '~icons/tabler/dots'

type SetActionsMenuProps = {
  name: string
  onOpen: () => void
  onEdit: () => void
  onDuplicate: () => void
  onDelete: () => void
}

export default function SetActionsMenu({ name, onOpen, onEdit, onDuplicate, onDelete }: SetActionsMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" aria-label={`Actions for ${name}`} onClick={(event) => event.stopPropagation()}>
          <IconDots className="h-5 w-5" aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuItem onSelect={onOpen}>Open</DropdownMenuItem>
        <DropdownMenuItem onSelect={onEdit}>Edit</DropdownMenuItem>
        <DropdownMenuItem onSelect={onDuplicate}>Duplicate</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem className="text-destructive focus:bg-destructive/10" onSelect={onDelete}>
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
