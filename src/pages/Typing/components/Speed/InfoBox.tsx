import React from 'react'

const InfoBox: React.FC<InfoBoxProps> = ({ info, description }) => {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-1 rounded-xl border border-border bg-card px-4 py-3 shadow-1">
      <span className="num text-center text-2xl font-semibold tracking-tight">{info}</span>
      <span className="text-eyebrow">{description}</span>
    </div>
  )
}

export default React.memo(InfoBox)

export type InfoBoxProps = {
  info: string
  description: string
}
