import Footer from '@/components/Footer'
import { Panel } from '@/components/ModePage'

export default function AboutPage() {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-6 md:px-8">
      <h1 className="text-2xl font-semibold">About &amp; support</h1>
      <Panel className="space-y-2 [&_footer_a]:inline-flex [&_footer_a]:p-3.5 [&_footer_button]:p-3.5">
        <p>
          Qwerty Learner helps you learn vocabulary by typing, flashcards on a spaced repetition schedule, quizzes and a matching game. It
          is built from open source projects and community contributions.
        </p>
        <p className="text-sm text-muted-foreground">Find the project, the community groups and ways to support it with the links below.</p>
        <Footer />
      </Panel>
    </div>
  )
}
