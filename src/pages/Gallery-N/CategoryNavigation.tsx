import { RadioGroup } from '@headlessui/react'
import { useState } from 'react'

interface Props {
  titles?: string[]
}

export default function CategoryNavigation({ titles = ['China Exams', 'Study Abroad Exams', 'Code Practice'] }: Props) {
  const [selectedTitle, setSelectedTitle] = useState(titles[0])

  return (
    <div className="mr-4 flex flex-col items-center justify-center pr-4">
      <RadioGroup value={selectedTitle} onChange={setSelectedTitle} className="flex flex-col gap-y-3">
        {titles.map((title) => (
          <RadioGroup.Option
            key={title}
            value={title}
            className={({ checked }) =>
              `flex cursor-pointer items-center space-x-2 ${checked ? 'text-foreground' : 'text-muted-foreground'}`
            }
          >
            {({ checked }) => (
              <>
                <div className={`mr-1 h-2.5 w-2.5 rounded-full ${checked ? 'bg-primary' : 'bg-primary/10'}`} />
                <RadioGroup.Label className="text-lg ">{title}</RadioGroup.Label>
              </>
            )}
          </RadioGroup.Option>
        ))}
      </RadioGroup>
    </div>
  )
}
