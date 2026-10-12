import React from 'react'

const InfoBox: React.FC<InfoBoxProps> = ({ info, description }) => {
  return (
    <div className="flex flex-1 flex-col items-center justify-center">
      <span className="w-4/5 border-b pb-2 text-center text-xl font-bold text-muted-foreground transition-colors duration-300">{info}</span>
      <span className="pt-2 text-xs transition-colors duration-300">{description}</span>
    </div>
  )
}

export default React.memo(InfoBox)

export type InfoBoxProps = {
  info: string
  description: string
}
