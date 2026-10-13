import type { AmountType } from '..'

export const Amount = ({
  amount,
  onClick,
  active = true,
}: {
  amount: AmountType
  onClick?: (amount: AmountType) => void
  active: boolean
}) => {
  return (
    <button
      className={` focus:  h-10 rounded border-border font-bold text-foreground shadow-md shadow-muted-foreground/30
 outline-none hover:bg-muted  dark:opacity-80 

 ${amount === -1 ? 'w-18' : 'w-10'} ${active ? 'bg-primary/10' : ''}`}
      onClick={() => onClick && onClick(amount)}
    >
      {amount === -1 ? 'Custom' : amount}
    </button>
  )
}
