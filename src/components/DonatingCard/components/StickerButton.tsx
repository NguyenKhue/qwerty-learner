import sticker2 from '@/assets/sticker2.jpg'
import sticker1 from '@/assets/sticker.jpg'
import { Tooltip } from 'react-tooltip'
import 'react-tooltip/dist/react-tooltip.css'
import IconInfo from '~icons/ic/outline-info'
import SolarStickerSmileSquareOutline from '~icons/solar/sticker-smile-square-outline'

export const StickerButton = ({ className }: { className?: string }) => {
  return (
    <>
      <div
        data-tooltip-id="sticker-btn"
        className={`w-max cursor-pointer rounded border-2 border-dashed border-border p-1.5 indent-0 text-sm font-bold text-muted-foreground transition-all hover:border-primary hover:text-primary

        ${className}`}
      >
        <SolarStickerSmileSquareOutline className="mb-[2px] mr-2 inline-block text-sm " />
        View stickers
      </div>
      <Tooltip
        id="sticker-btn"
        opacity={1}
        className="flex flex-col items-center justify-center gap-2 rounded-lg !bg-muted !p-4 shadow-lg shadow-muted-foreground/30 
        dark:shadow-lg"
      >
        <div className="flex gap-2">
          <img src={sticker1} alt="alipay" className=" h-44 rounded shadow-lg shadow-muted-foreground/30" />
          <img src={sticker2} alt="alipay" className=" h-44 rounded shadow-lg shadow-muted-foreground/30" />
        </div>
        <span className="mt-3 text-xs font-bold text-muted-foreground">
          <IconInfo className="mb-[3px] mr-1 inline-block" />
          This sticker is not a product. It is only a token of thanks for your donation and cannot be used for any commercial purpose.
        </span>
      </Tooltip>
    </>
  )
}
