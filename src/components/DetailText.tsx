import { parseDetail } from '@/utils/detail/format'

/**
 * A word detail, one paragraph per line: the first line is the headline, every other line is body text.
 * A `Label: text` line keeps its label in bold and its text muted; a line without a label is fully muted.
 */
export default function DetailText({ text }: { text: string }) {
  const lines = parseDetail(text)

  return (
    <div className="space-y-2 text-left">
      {lines.map((line, index) =>
        index === 0 ? (
          <p key={index} className="text-base font-semibold text-foreground">
            {line.label ? `${line.label}: ${line.text}` : line.text}
          </p>
        ) : (
          <p key={index} className="text-sm leading-relaxed">
            {line.label ? (
              <>
                <span className="font-semibold text-foreground">{line.label}:</span>{' '}
                <span className="text-muted-foreground">{line.text}</span>
              </>
            ) : (
              <span className="text-muted-foreground">{line.text}</span>
            )}
          </p>
        ),
      )}
    </div>
  )
}
