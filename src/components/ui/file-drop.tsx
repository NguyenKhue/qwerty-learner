import { cn } from '@/utils/ui'
import * as React from 'react'
import IconUpload from '~icons/tabler/upload'

export interface FileDropProps {
  accept?: string
  onFile: (file: File) => void
  /** When given, several files may be chosen or dropped at once and are passed together instead of one by one through `onFile` */
  onFiles?: (files: File[]) => void
  label?: React.ReactNode
  description?: React.ReactNode
  disabled?: boolean
  className?: string
}

/**
 * The whole zone is a `<label>`, so a click opens the real file input; the input itself stays in the
 * tab order (`sr-only`, not `hidden`) so the zone can also be reached and triggered from the keyboard.
 */
export function FileDrop({
  accept,
  onFile,
  onFiles,
  label = 'Drop a file here or choose one',
  description,
  disabled = false,
  className,
}: FileDropProps) {
  const inputRef = React.useRef<HTMLInputElement>(null)
  const inputId = React.useId()
  const [dragging, setDragging] = React.useState(false)
  const [fileName, setFileName] = React.useState<string | null>(null)

  const handleFiles = (list: FileList | null | undefined) => {
    const files = list ? Array.from(list) : []
    if (disabled || files.length === 0) return
    if (onFiles) {
      setFileName(files.length === 1 ? files[0].name : `${files.length} files`)
      onFiles(files)
      return
    }
    setFileName(files[0].name)
    onFile(files[0])
  }

  return (
    <label
      htmlFor={inputId}
      onDragOver={(event) => {
        event.preventDefault()
        if (!disabled) setDragging(true)
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(event) => {
        event.preventDefault()
        setDragging(false)
        handleFiles(event.dataTransfer.files)
      }}
      className={cn(
        'flex min-h-[96px] cursor-pointer flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-border bg-card p-4 text-center shadow-1 transition-[background-color,border-color] duration-fast ease-out focus-within:ring-2 focus-within:ring-ring',
        dragging && 'border-primary bg-primary/5',
        disabled && 'pointer-events-none opacity-50',
        className,
      )}
    >
      <IconUpload aria-hidden="true" className="h-6 w-6 text-muted-foreground" />
      <span className={cn('text-sm font-medium text-foreground', dragging && 'text-primary')}>{fileName ?? label}</span>
      {description && !fileName ? <span className="text-xs text-muted-foreground">{description}</span> : null}
      <input
        ref={inputRef}
        id={inputId}
        type="file"
        accept={accept}
        disabled={disabled}
        multiple={Boolean(onFiles)}
        className="sr-only"
        onChange={(event) => {
          handleFiles(event.target.files)
          // Clearing the value lets the same file be picked again after an edit
          event.target.value = ''
        }}
      />
    </label>
  )
}
