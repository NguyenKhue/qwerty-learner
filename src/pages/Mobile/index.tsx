import logo from '@/assets/logo.svg'
import directoryImg from '@/assets/mobile/carousel/directory.png'
import hotImg from '@/assets/mobile/carousel/hot.png'
import indexImg from '@/assets/mobile/carousel/index.png'
import codeImg from '@/assets/mobile/detail/code.png'
import dictationImg from '@/assets/mobile/detail/dictation.png'
import phoneticImg from '@/assets/mobile/detail/phonetic.png'
import speedImg from '@/assets/mobile/detail/speed.png'
import type React from 'react'
import { useEffect, useRef, useState } from 'react'

const detail = [
  {
    title: 'Phonetic Display & Pronunciation',
    description: 'Helps you remember the pronunciation and the phonetic spelling of a word at the same time',
    img: phoneticImg,
  },
  {
    title: 'Dictation Mode',
    description: 'Offered after each chapter so you can consolidate what you just learned',
    img: dictationImg,
  },
  {
    title: 'Real-time Feedback',
    description: 'Shows your typing speed and accuracy to quantify your progress',
    img: speedImg,
  },
  {
    title: 'Built for Programmers',
    description: 'Includes programming-related word lists to boost your work efficiency',
    img: codeImg,
  },
]

const MobilePage: React.FC = () => {
  const [currentSlide, setCurrentSlide] = useState(0)
  const totalSlides = 3 // total number of carousel slides
  const containerRef = useRef<HTMLDivElement>(null)
  const [activeIndex, setActiveIndex] = useState(0)

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentSlide((prevSlide) => (prevSlide + 1) % totalSlides)
    }, 3000)

    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    if (containerRef.current) {
      const container = containerRef.current
      const slideWidth = container.offsetWidth

      if (currentSlide === 0) {
        container.style.transform = `translateX(-${totalSlides * slideWidth}px)`
        setTimeout(() => {
          container.style.transition = 'none'
          container.style.transform = `translateX(0)`
        }, 500)
      } else {
        container.style.transition = 'transform 0.5s ease'
        container.style.transform = `translateX(-${currentSlide * slideWidth}px)`
      }
    }
  }, [currentSlide])

  return (
    <div className="flex w-screen flex-col bg-white lg:mx-auto lg:max-w-7xl">
      <header className="fixed left-0 right-0 top-0 z-50 flex items-center justify-between border-b border-gray-100/50 bg-white/80 px-6 py-6 backdrop-blur-xl lg:px-12">
        <div className="flex items-center">
          <img src={logo} className="mr-4 h-10 w-10 lg:h-12 lg:w-12" alt="Qwerty Learner Logo" />
          <div className="flex flex-col">
            <h1 className="text-lg font-semibold tracking-tight text-indigo-500 lg:text-xl">Qwerty Learner</h1>
            <span className="text-xs font-normal text-gray-500">Official Site</span>
          </div>
        </div>
        <a
          href="/"
          target="_blank"
          rel="noopener noreferrer"
          className="hidden items-center gap-2 rounded-xl bg-gray-900 px-6 py-3 text-sm font-medium text-white transition-all duration-200 hover:-translate-y-0.5 hover:bg-gray-800 hover:shadow-lg md:flex"
        >
          <span>Visit Site</span>
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
            />
          </svg>
        </a>
        <a
          href="/"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 rounded-xl bg-gray-900 px-4 py-2.5 text-sm text-white transition-all duration-200 hover:bg-gray-800 md:hidden"
        >
          <span>Website</span>
          <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
            />
          </svg>
        </a>
      </header>

      {/* breadcrumb navigation */}
      <nav aria-label="Breadcrumb" className="bg-gray-50/50 px-6 py-3 lg:px-24">
        <div className="mx-auto max-w-7xl">
          <ol className="flex items-center space-x-2 text-sm text-gray-500" itemScope itemType="https://schema.org/BreadcrumbList">
            <li itemProp="itemListElement" itemScope itemType="https://schema.org/ListItem">
              <a href="/" className="transition-colors hover:text-indigo-600" itemProp="item">
                <span itemProp="name">Home</span>
              </a>
              <meta itemProp="position" content="1" />
            </li>
            <li className="flex items-center">
              <svg className="h-4 w-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
              </svg>
            </li>
            <li itemProp="itemListElement" itemScope itemType="https://schema.org/ListItem">
              <span className="font-medium text-gray-900" itemProp="name">
                Qwerty Learner Official Site
              </span>
              <meta itemProp="position" content="2" />
            </li>
          </ol>
        </div>
      </nav>

      <main role="main">
        <section
          className="relative mt-20 flex min-h-[90vh] items-center lg:mt-24"
          itemScope
          itemType="https://schema.org/SoftwareApplication"
        >
          {/* clean gradient background */}
          <div className="absolute inset-0 bg-gradient-to-br from-gray-50/50 via-white to-slate-50/30"></div>

          {/* main content */}
          <div className="relative z-10 mx-auto w-full max-w-5xl px-6 py-24 text-center">
            {/* official site badge */}
            <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-indigo-100 bg-indigo-50 px-5 py-2.5 text-sm font-medium text-indigo-600">
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>Official Site</span>
            </div>

            {/* main headline */}
            <h1 className="mb-8 text-5xl font-bold leading-[1.1] tracking-tight text-gray-900 sm:text-6xl lg:text-7xl" itemProp="name">
              An English Learning App
              <br />
              Built for <span className="text-indigo-500">Keyboard Workers</span>
            </h1>

            {/* sub headline */}
            <p className="mx-auto mb-16 max-w-3xl text-xl font-light leading-relaxed text-gray-600 sm:text-2xl" itemProp="description">
              Combining typing practice with vocabulary memorization to make learning English efficient and fun
            </p>

            {/* feature tags */}
            <div className="mb-16 flex flex-wrap justify-center gap-3" itemProp="featureList">
              {[
                'English vocabulary training',
                'IPA pronunciation practice',
                'CET-4/6 word lists',
                'Vocabulary for programmers',
                'Free online learning',
                'Fully open source',
              ].map((item, index) => (
                <span
                  key={index}
                  className="rounded-full border border-gray-200/50 bg-gray-50 px-6 py-3 text-sm font-medium text-gray-700 transition-all duration-200 hover:bg-white hover:shadow-sm"
                >
                  {item}
                </span>
              ))}
            </div>

            {/* CTA button */}
            <a
              href="/"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-3 rounded-full bg-gray-900 px-10 py-5 text-lg font-semibold text-white shadow-xl transition-all duration-300 hover:-translate-y-1 hover:bg-gray-800 hover:shadow-2xl"
            >
              <span>Get Started Now</span>
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 8l4 4m0 0l-4 4m4-4H3" />
              </svg>
            </a>
          </div>
        </section>

        <section className="mt-24 px-6 md:px-12 lg:mt-32 lg:px-24">
          <div className="relative overflow-hidden rounded-3xl border border-gray-100 bg-white p-2 shadow-2xl">
            <div className="overflow-hidden rounded-2xl bg-white">
              <div
                ref={containerRef}
                style={{
                  display: 'flex',
                  transition: 'transform 0.5s ease',
                }}
              >
                <img
                  src={hotImg}
                  alt="Qwerty Learner popular word list screen - online practice for CET-4/6, IELTS and TOEFL vocabulary"
                  className="w-full flex-shrink-0"
                />
                <img
                  src={directoryImg}
                  alt="Qwerty Learner free English learning app word list catalog - technical English for programmers"
                  className="w-full flex-shrink-0"
                />
                <img
                  src={indexImg}
                  alt="Qwerty Learner typing practice main screen - online English vocabulary training"
                  className="w-full flex-shrink-0"
                />
                <img
                  src={hotImg}
                  alt="Qwerty Learner popular word list screen - online practice for CET-4/6, IELTS and TOEFL vocabulary"
                  className="w-full flex-shrink-0"
                />
              </div>
            </div>
            <div className="mt-8 flex justify-center space-x-3">
              {[0, 1, 2].map((index) => (
                <div
                  key={index}
                  className={`h-2 w-2 rounded-full transition-all duration-500 ${
                    currentSlide === index ? 'w-8 bg-indigo-500' : 'bg-gray-300 hover:bg-indigo-300'
                  }`}
                />
              ))}
            </div>
          </div>
        </section>

        <section className="mt-24 bg-gray-50/30 px-6 py-24 lg:mt-32 lg:px-24" itemScope itemType="https://schema.org/Product">
          <div className="mx-auto max-w-7xl">
            <meta itemProp="name" content="Qwerty Learner" />
            <meta
              itemProp="description"
              content="An English learning app built for keyboard workers, combining typing practice with vocabulary memorization"
            />
            <meta itemProp="brand" content="Qwerty Learner" />

            {/* Offers Schema */}
            <div itemProp="offers" itemScope itemType="https://schema.org/Offer">
              <meta itemProp="price" content="0" />
              <meta itemProp="priceCurrency" content="USD" />
              <meta itemProp="availability" content="https://schema.org/InStock" />
              <meta itemProp="url" content="https://qwerty.kaiyi.cool/" />
            </div>

            {/* Aggregate Rating */}
            <div itemProp="aggregateRating" itemScope itemType="https://schema.org/AggregateRating">
              <meta itemProp="ratingValue" content="4.8" />
              <meta itemProp="bestRating" content="5" />
              <meta itemProp="worstRating" content="1" />
              <meta itemProp="ratingCount" content="2156" />
              <meta itemProp="reviewCount" content="486" />
            </div>

            {/* Individual Reviews */}
            <div itemProp="review" itemScope itemType="https://schema.org/Review">
              <meta itemProp="author" content="Alex - Front-end Engineer" />
              <div itemProp="reviewRating" itemScope itemType="https://schema.org/Rating">
                <meta itemProp="ratingValue" content="5" />
                <meta itemProp="bestRating" content="5" />
              </div>
              <meta itemProp="datePublished" content="2024-11-15" />
              <meta
                itemProp="reviewBody"
                content="As a programmer, this tool solves my problem perfectly. Practicing typing while memorizing vocabulary doubles my efficiency! The programmer word list in particular got me familiar with the vocabulary used in technical documentation fast. The keyboard sounds make the whole site feel great, I just can't stop."
              />
            </div>

            <div itemProp="review" itemScope itemType="https://schema.org/Review">
              <meta itemProp="author" content="Jamie - University Student" />
              <div itemProp="reviewRating" itemScope itemType="https://schema.org/Rating">
                <meta itemProp="ratingValue" content="5" />
                <meta itemProp="bestRating" content="5" />
              </div>
              <meta itemProp="datePublished" content="2024-10-28" />
              <meta
                itemProp="reviewBody"
                content="A gem I found while preparing for the CET-6 exam! The CET-6 word list is very comprehensive, and dictation mode helped me consolidate a lot of easy-to-miss words. My favorite is the mistake book, which lets me repeatedly practice the words I struggle with. After just one month both my typing speed and vocabulary have improved noticeably."
              />
            </div>

            <div itemProp="review" itemScope itemType="https://schema.org/Review">
              <meta itemProp="author" content="Sam - Backend Developer" />
              <div itemProp="reviewRating" itemScope itemType="https://schema.org/Rating">
                <meta itemProp="ratingValue" content="5" />
                <meta itemProp="bestRating" content="5" />
              </div>
              <meta itemProp="datePublished" content="2024-09-20" />
              <meta
                itemProp="reviewBody"
                content="I saw 17.5k stars on GitHub and gave it a try, and it did not disappoint! The VSCode extension is super convenient: when coding tires you out, just switch over and drill a few words. The JavaScript API practice mode helps me a lot too, and I no longer have to look up the docs every time I write JS."
              />
            </div>

            <div itemProp="review" itemScope itemType="https://schema.org/Review">
              <meta itemProp="author" content="Taylor - Product Manager" />
              <div itemProp="reviewRating" itemScope itemType="https://schema.org/Rating">
                <meta itemProp="ratingValue" content="4" />
                <meta itemProp="bestRating" content="5" />
              </div>
              <meta itemProp="datePublished" content="2024-08-12" />
              <meta
                itemProp="reviewBody"
                content="A clean interface with genuinely useful features. The phonetic display and pronunciation are a big help, letting me correct my pronunciation while typing. My only suggestion is to add more business English vocabulary, but the community is clearly active so I expect it to keep improving."
              />
            </div>

            <div itemProp="review" itemScope itemType="https://schema.org/Review">
              <meta itemProp="author" content="Jordan - Full-stack Engineer" />
              <div itemProp="reviewRating" itemScope itemType="https://schema.org/Rating">
                <meta itemProp="ratingValue" content="5" />
                <meta itemProp="bestRating" content="5" />
              </div>
              <meta itemProp="datePublished" content="2024-07-05" />
              <meta
                itemProp="reviewBody"
                content="A model open source project! The code quality is excellent and I have even contributed a few PRs myself. The muscle-memory training concept is brilliant, having to retype after a mistake prevents bad habits. I now read English documentation much faster and my typing is more accurate. Highly recommended to every keyboard worker!"
              />
            </div>
            <h2 className="mb-6 text-center text-4xl font-bold tracking-tight text-gray-900 lg:text-5xl xl:text-6xl">
              Core Features, <span className="text-indigo-500">Thoughtfully Designed</span>
            </h2>
            <p className="mx-auto mb-16 max-w-3xl text-center text-xl font-light leading-relaxed text-gray-600">
              Every detail is carefully polished for a better online English learning experience, helping programmers, students and office
              workers alike quickly improve their typing speed and vocabulary in English
            </p>

            <div className="lg:grid lg:grid-cols-2 lg:gap-12">
              <div>
                {detail.map((item, index) => {
                  return (
                    <div
                      key={index}
                      className={`my-6 cursor-pointer rounded-2xl border px-8 py-8 transition-all duration-300 ${
                        activeIndex === index
                          ? 'scale-[1.02] transform border-indigo-200 bg-indigo-50/50 shadow-xl'
                          : 'border-gray-200 bg-white/50 hover:scale-[1.01] hover:transform hover:border-gray-300 hover:bg-white hover:shadow-lg'
                      }`}
                      onClick={() => setActiveIndex(index)}
                    >
                      <h3 className="mb-3 text-xl font-semibold text-indigo-500 lg:text-2xl">{item.title}</h3>
                      <p className="text-base font-light leading-relaxed text-gray-600 lg:text-lg">{item.description}</p>
                    </div>
                  )
                })}
              </div>

              <div className="mt-16 flex h-[14rem] items-center justify-center rounded-3xl border border-gray-200 bg-white p-8 shadow-2xl lg:mt-0 lg:h-auto lg:p-12">
                <img
                  className="w-full object-contain"
                  src={detail[activeIndex].img}
                  alt={`Qwerty Learner ${detail[activeIndex].title} preview - screenshot of this English learning app feature`}
                />
              </div>
            </div>

            {/* detailed feature descriptions */}
            <div className="mt-16 lg:mt-24">
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {/* phonetic display and pronunciation */}
                <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-lg transition-all duration-300 hover:shadow-xl sm:p-8">
                  <div className="mb-4 inline-flex items-center justify-center rounded-full bg-indigo-100 p-3">
                    <svg className="h-6 w-6 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z"
                      />
                    </svg>
                  </div>
                  <h3 className="mb-3 text-lg font-semibold text-gray-900 sm:text-xl">Phonetic Display &amp; Pronunciation</h3>
                  <p className="text-sm leading-relaxed text-gray-600 sm:text-base">
                    Helps you memorize both the sound and the phonetic spelling of a word at the same time. Standard American pronunciation
                    is supported, so you build correct sound associations and improve your listening and speaking skills.
                  </p>
                </div>

                {/* dictation mode */}
                <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-lg transition-all duration-300 hover:shadow-xl sm:p-8">
                  <div className="mb-4 inline-flex items-center justify-center rounded-full bg-indigo-100 p-3">
                    <svg className="h-6 w-6 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                      />
                    </svg>
                  </div>
                  <h3 className="mb-3 text-lg font-semibold text-gray-900 sm:text-xl">Smart Dictation Mode</h3>
                  <p className="text-sm leading-relaxed text-gray-600 sm:text-base">
                    After you finish practicing a chapter, you are asked whether you want to dictate it, so you can consolidate the words
                    you just learned. Dictation practice reinforces your memory.
                  </p>
                </div>

                {/* speed statistics */}
                <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-lg transition-all duration-300 hover:shadow-xl sm:p-8">
                  <div className="mb-4 inline-flex items-center justify-center rounded-full bg-indigo-100 p-3">
                    <svg className="h-6 w-6 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                      />
                    </svg>
                  </div>
                  <h3 className="mb-3 text-lg font-semibold text-gray-900 sm:text-xl">Accurate Statistics</h3>
                  <p className="text-sm leading-relaxed text-gray-600 sm:text-base">
                    Quantifies your typing speed and accuracy so you can clearly see how your skills are improving. Supports WPM tracking,
                    accuracy analysis and progress monitoring.
                  </p>
                </div>

                {/* muscle memory */}
                <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-lg transition-all duration-300 hover:shadow-xl sm:p-8">
                  <div className="mb-4 inline-flex items-center justify-center rounded-full bg-indigo-100 p-3">
                    <svg className="h-6 w-6 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                  </div>
                  <h3 className="mb-3 text-lg font-semibold text-gray-900 sm:text-xl">Muscle Memory Training</h3>
                  <p className="text-sm leading-relaxed text-gray-600 sm:text-base">
                    Designed specifically for keyboard workers, it combines English vocabulary memorization with muscle-memory typing
                    practice, so your typing skills get stronger while you learn words.
                  </p>
                </div>

                {/* mistake correction */}
                <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-lg transition-all duration-300 hover:shadow-xl sm:p-8">
                  <div className="mb-4 inline-flex items-center justify-center rounded-full bg-indigo-100 p-3">
                    <svg className="h-6 w-6 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                  </div>
                  <h3 className="mb-3 text-lg font-semibold text-gray-900 sm:text-xl">Smart Mistake Correction</h3>
                  <p className="text-sm leading-relaxed text-gray-600 sm:text-base">
                    To avoid building incorrect muscle memory, you have to retype a word whenever you get it wrong, keeping your muscle
                    memory and spelling habits accurate.
                  </p>
                </div>

                {/* multi platform support */}
                <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-lg transition-all duration-300 hover:shadow-xl sm:p-8">
                  <div className="mb-4 inline-flex items-center justify-center rounded-full bg-indigo-100 p-3">
                    <svg className="h-6 w-6 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                      />
                    </svg>
                  </div>
                  <h3 className="mb-3 text-lg font-semibold text-gray-900 sm:text-xl">Seamless Cross-Platform Experience</h3>
                  <p className="text-sm leading-relaxed text-gray-600 sm:text-base">
                    Available both on the web and as a VSCode extension, so you can practice wherever you are. A convenient one-click
                    deployment option is also provided to suit different needs.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* word list showcase */}
        <section className="mt-24 px-6 py-24 lg:mt-32 lg:px-24" itemScope itemType="https://schema.org/EducationalOrganization">
          <div className="mx-auto max-w-7xl">
            <div className="mb-16 text-center">
              <h2 className="mb-6 text-4xl font-bold tracking-tight text-gray-900 lg:text-5xl xl:text-6xl">
                Rich Word Lists, <span className="text-indigo-500">Everything You Need</span>
              </h2>
              <p className="mx-auto max-w-3xl text-xl font-light leading-relaxed text-gray-600">
                Covering CET-4/6 English exams, IELTS, TOEFL, GRE and postgraduate entrance English, the BEC business English exam, and
                JavaScript/Java/Python technical word lists built for programmers, so every kind of learner finds what they need
              </p>
            </div>

            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {/* exam word lists */}
              <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-lg transition-all duration-300 hover:shadow-xl sm:p-8">
                <div className="mb-6 inline-flex items-center justify-center rounded-full bg-red-100 p-3">
                  <svg className="h-6 w-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                    />
                  </svg>
                </div>
                <h3 className="mb-4 text-lg font-semibold text-gray-900 sm:text-xl">Exam Essentials</h3>
                <div className="space-y-2 text-xs text-gray-600 sm:text-sm">
                  <div className="flex items-center gap-2">
                    <span className="text-indigo-500">•</span>
                    <span>CET-4 College English Test Band 4</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-indigo-500">•</span>
                    <span>CET-6 College English Test Band 6</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-indigo-500">•</span>
                    <span>TOEFL Vocabulary</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-indigo-500">•</span>
                    <span>IELTS Vocabulary</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-indigo-500">•</span>
                    <span>GRE Graduate Record Examination</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-indigo-500">•</span>
                    <span>GMAT Business School Admission Test</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-indigo-500">•</span>
                    <span>SAT Scholastic Assessment Test</span>
                  </div>
                </div>
              </div>

              {/* academic word lists */}
              <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-lg transition-all duration-300 hover:shadow-xl sm:p-8">
                <div className="mb-6 inline-flex items-center justify-center rounded-full bg-blue-100 p-3">
                  <svg className="h-6 w-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
                    />
                  </svg>
                </div>
                <h3 className="mb-4 text-lg font-semibold text-gray-900 sm:text-xl">Academic &amp; School</h3>
                <div className="space-y-2 text-xs text-gray-600 sm:text-sm">
                  <div className="flex items-center gap-2">
                    <span className="text-indigo-500">•</span>
                    <span>Postgraduate Entrance English Core Vocabulary</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-indigo-500">•</span>
                    <span>TEM-4 English for English Majors</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-indigo-500">•</span>
                    <span>TEM-8 English for English Majors</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-indigo-500">•</span>
                    <span>Gaokao English Essentials</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-indigo-500">•</span>
                    <span>Zhongkao English Key Vocabulary</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-indigo-500">•</span>
                    <span>PEP English, Grades 3-9</span>
                  </div>
                </div>
              </div>

              {/* business and languages */}
              <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-lg transition-all duration-300 hover:shadow-xl sm:p-8">
                <div className="mb-6 inline-flex items-center justify-center rounded-full bg-green-100 p-3">
                  <svg className="h-6 w-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2-2v2m8 0H8m8 0v2a2 2 0 01-2 2H10a2 2 0 01-2-2V6m8 0H8"
                    />
                  </svg>
                </div>
                <h3 className="mb-4 text-lg font-semibold text-gray-900 sm:text-xl">Business &amp; Multilingual</h3>
                <div className="space-y-2 text-xs text-gray-600 sm:text-sm">
                  <div className="flex items-center gap-2">
                    <span className="text-indigo-500">•</span>
                    <span>Business English Core Vocabulary</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-indigo-500">•</span>
                    <span>BEC Business English Certificate</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-indigo-500">•</span>
                    <span>Wang Lu IELTS Listening Corpus</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-indigo-500">•</span>
                    <span>Japanese JLPT N1-N5 Vocabulary</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-indigo-500">•</span>
                    <span>Kazakh 3000 Basic Words</span>
                  </div>
                </div>
              </div>

              {/* for programmers only */}
              <div className="col-span-full rounded-2xl border border-indigo-200 bg-gradient-to-r from-indigo-50 to-purple-50 p-6 shadow-lg sm:p-8">
                <div className="mb-8 text-center">
                  <div className="mb-4 inline-flex items-center justify-center rounded-full bg-indigo-100 p-4">
                    <svg className="h-8 w-8 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                    </svg>
                  </div>
                  <h3 className="mb-4 text-xl font-bold text-gray-900 sm:text-2xl">Word Lists &amp; APIs for Programmers</h3>
                  <p className="mx-auto max-w-3xl text-gray-600">
                    Technical vocabulary and programming API practice tailored to programmers, to improve both your coding efficiency and
                    your technical English
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
                  <div className="text-center">
                    <div className="mb-2 text-sm font-semibold text-gray-900 sm:text-base">Programming Vocabulary</div>
                    <div className="text-xs text-gray-600 sm:text-sm">
                      Coder Dict
                      <br />
                      Everyday words for programmers
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="mb-2 text-sm font-semibold text-gray-900 sm:text-base">JavaScript</div>
                    <div className="text-xs text-gray-600 sm:text-sm">
                      JS API
                      <br />
                      Core method practice
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="mb-2 text-sm font-semibold text-gray-900 sm:text-base">Node.js</div>
                    <div className="text-xs text-gray-600 sm:text-sm">
                      Node API
                      <br />
                      Server-side development
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="mb-2 text-sm font-semibold text-gray-900 sm:text-base">Java</div>
                    <div className="text-xs text-gray-600 sm:text-sm">
                      Java API
                      <br />
                      Enterprise development
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="mb-2 text-sm font-semibold text-gray-900 sm:text-base">Linux</div>
                    <div className="text-xs text-gray-600 sm:text-sm">
                      Command-line commands
                      <br />
                      System administration
                    </div>
                  </div>
                </div>

                <div className="mt-8 text-center">
                  <span className="inline-flex items-center gap-2 rounded-full bg-indigo-100 px-6 py-2 text-sm font-medium text-indigo-600">
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                    More programming language APIs added continuously
                  </span>
                </div>
              </div>
            </div>

            <div className="mt-16 text-center">
              <div className="mb-8">
                <h4 className="mb-4 text-2xl font-bold text-gray-900">Built by the Community, Growing Together</h4>
                <p className="mx-auto max-w-2xl text-gray-600">
                  Our word lists are contributed and maintained by an active open source community. If you need a specific list, feel free
                  to open an issue on GitHub
                </p>
              </div>
              <a
                href="/"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-full bg-indigo-600 px-8 py-4 font-semibold text-white transition-all duration-300 hover:bg-indigo-700 hover:shadow-lg"
              >
                <span>Explore the word lists now</span>
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 8l4 4m0 0l-4 4m4-4H3" />
                </svg>
              </a>
            </div>
          </div>
        </section>

        {/* programmer only section */}
        <section
          className="mt-24 bg-gradient-to-br from-slate-900 via-gray-900 to-black px-6 py-24 lg:mt-32 lg:px-24"
          itemScope
          itemType="https://schema.org/SoftwareSourceCode"
        >
          <div className="mx-auto max-w-7xl">
            <div className="mb-16 text-center">
              <div className="mb-6 inline-flex items-center gap-3 rounded-full bg-indigo-100 px-6 py-3 text-indigo-600">
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                </svg>
                <span className="font-semibold">For Coder</span>
              </div>
              <h2 className="mb-6 text-4xl font-bold tracking-tight text-white lg:text-5xl xl:text-6xl">
                Tailor-made for <span className="text-indigo-400">Programmers</span>
              </h2>
              <p className="mx-auto max-w-3xl text-xl font-light leading-relaxed text-gray-300">
                Built-in technical English word lists for everyday programmer work, covering algorithms and data structures, design
                patterns, cloud computing and more, to sharpen your English typing speed. It also supports API practice for JavaScript,
                Node.js, Java, Python and Linux commands, helping programmers get familiar with common programming interfaces quickly
              </p>
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
              {/* left: technical vocabulary */}
              <div className="rounded-2xl border border-gray-700 bg-gray-800/50 p-6 backdrop-blur-sm sm:p-8">
                <div className="mb-6 flex items-center gap-4">
                  <div className="rounded-full bg-indigo-600 p-3">
                    <svg className="h-6 w-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                      />
                    </svg>
                  </div>
                  <h3 className="text-xl font-bold text-white sm:text-2xl">Programming Vocabulary</h3>
                </div>
                <p className="mb-6 text-sm leading-relaxed text-gray-300 sm:text-base">
                  Curates the English words programmers use most in their work, including core vocabulary from algorithms, data structures,
                  design patterns and software engineering
                </p>
                <div className="space-y-3">
                  <div className="flex items-center gap-3 rounded-lg bg-gray-700/50 p-3">
                    <span className="text-indigo-400">•</span>
                    <span className="text-gray-200">Algorithms &amp; data structures vocabulary</span>
                  </div>
                  <div className="flex items-center gap-3 rounded-lg bg-gray-700/50 p-3">
                    <span className="text-indigo-400">•</span>
                    <span className="text-gray-200">Software architecture &amp; design patterns</span>
                  </div>
                  <div className="flex items-center gap-3 rounded-lg bg-gray-700/50 p-3">
                    <span className="text-indigo-400">•</span>
                    <span className="text-gray-200">Project management &amp; collaboration tools</span>
                  </div>
                  <div className="flex items-center gap-3 rounded-lg bg-gray-700/50 p-3">
                    <span className="text-indigo-400">•</span>
                    <span className="text-gray-200">Cloud computing &amp; DevOps terminology</span>
                  </div>
                </div>
              </div>

              {/* right: API practice */}
              <div className="rounded-2xl border border-gray-700 bg-gray-800/50 p-6 backdrop-blur-sm sm:p-8">
                <div className="mb-6 flex items-center gap-4">
                  <div className="rounded-full bg-green-600 p-3">
                    <svg className="h-6 w-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                    </svg>
                  </div>
                  <h3 className="text-xl font-bold text-white sm:text-2xl">API Method Practice</h3>
                </div>
                <p className="mb-6 text-sm leading-relaxed text-gray-300 sm:text-base">
                  Supports API practice in many mainstream programming languages, so you learn common methods through typing and improve
                  both coding efficiency and API recall
                </p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-lg border border-yellow-500/30 bg-yellow-500/10 p-4">
                    <div className="mb-2 font-semibold text-yellow-400">JavaScript</div>
                    <div className="text-sm text-gray-300">Core APIs such as Array, Object and Promise</div>
                  </div>
                  <div className="rounded-lg border border-green-500/30 bg-green-500/10 p-4">
                    <div className="mb-2 font-semibold text-green-400">Node.js</div>
                    <div className="text-sm text-gray-300">Server-side APIs such as fs, http and express</div>
                  </div>
                  <div className="rounded-lg border border-orange-500/30 bg-orange-500/10 p-4">
                    <div className="mb-2 font-semibold text-orange-400">Java</div>
                    <div className="text-sm text-gray-300">Enterprise APIs such as Collection and Stream</div>
                  </div>
                  <div className="rounded-lg border border-blue-500/30 bg-blue-500/10 p-4">
                    <div className="mb-2 font-semibold text-blue-400">Linux</div>
                    <div className="text-sm text-gray-300">Common command-line commands and system administration</div>
                  </div>
                </div>
              </div>
            </div>

            {/* highlight feature showcase */}
            <div className="mt-16 grid gap-8 md:grid-cols-3">
              <div className="text-center">
                <div className="mb-4 inline-flex items-center justify-center rounded-full bg-indigo-600/20 p-4">
                  <svg className="h-8 w-8 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
                <h4 className="mb-3 text-xl font-semibold text-white">Get familiar with APIs fast</h4>
                <p className="text-gray-300">Memorize programming APIs through typing practice and work more efficiently</p>
              </div>
              <div className="text-center">
                <div className="mb-4 inline-flex items-center justify-center rounded-full bg-green-600/20 p-4">
                  <svg className="h-8 w-8 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                    />
                  </svg>
                </div>
                <h4 className="mb-3 text-xl font-semibold text-white">Better Technical English</h4>
                <p className="text-gray-300">
                  Train with professional technical vocabulary to improve documentation reading and communication
                </p>
              </div>
              <div className="text-center">
                <div className="mb-4 inline-flex items-center justify-center rounded-full bg-purple-600/20 p-4">
                  <svg className="h-8 w-8 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z"
                    />
                  </svg>
                </div>
                <h4 className="mb-3 text-xl font-semibold text-white">VSCode Extension</h4>
                <p className="text-gray-300">A VSCode extension lets you practice right inside your development environment</p>
              </div>
            </div>

            <div className="mt-16 text-center">
              <div className="mb-8">
                <h4 className="mb-4 text-2xl font-bold text-white">Community-driven and always updating</h4>
                <p className="mx-auto max-w-2xl text-gray-300">
                  Our API word lists rely on community contributions, and APIs for more programming languages are being added steadily.
                  Contributions are very welcome
                </p>
              </div>
              <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
                <a
                  href="/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-full bg-indigo-600 px-8 py-4 font-semibold text-white transition-all duration-300 hover:bg-indigo-700 hover:shadow-lg"
                >
                  <span>Try the programmer-only features</span>
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 8l4 4m0 0l-4 4m4-4H3" />
                  </svg>
                </a>
                <a
                  href="https://marketplace.visualstudio.com/items?itemName=Kaiyi.qwerty-learner"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-full border border-gray-600 bg-gray-800 px-8 py-4 font-semibold text-white transition-all duration-300 hover:bg-gray-700"
                >
                  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M23.15 2.587L18.21.21a1.494 1.494 0 0 0-1.705.29l-9.46 8.63-4.12-3.128a.999.999 0 0 0-1.276.057L.327 7.261A1 1 0 0 0 .326 8.74L3.899 12 .326 15.26a1 1 0 0 0 .001 1.479L1.65 17.94a.999.999 0 0 0 1.276.057l4.12-3.128 9.46 8.63a1.492 1.492 0 0 0 1.704.29l4.942-2.377A1.5 1.5 0 0 0 24 20.06V3.939a1.5 1.5 0 0 0-.85-1.352zm-5.146 14.861L10.826 12l7.178-5.448v10.896z" />
                  </svg>
                  <span>Install the VSCode extension</span>
                </a>
              </div>
            </div>
          </div>
        </section>

        {/* awards and recognition section */}
        <section
          className="mt-24 bg-gradient-to-br from-gray-50 to-white px-6 py-24 lg:mt-32 lg:px-24"
          itemScope
          itemType="https://schema.org/Organization"
        >
          <div className="mx-auto max-w-7xl">
            <div className="mb-16 text-center">
              <div className="mb-6 inline-flex items-center gap-3 rounded-full bg-yellow-100 px-6 py-3 text-yellow-600">
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z"
                  />
                </svg>
                <span className="font-semibold">Awards &amp; Recognition</span>
              </div>
              <h2 className="mb-6 text-4xl font-bold tracking-tight text-gray-900 lg:text-5xl xl:text-6xl">
                A high-quality project <span className="text-indigo-500">widely recognized</span>
              </h2>
              <p className="mx-auto max-w-3xl text-xl font-light leading-relaxed text-gray-600">
                Recognized by many authoritative platforms, including the #1 spot on GitHub Trending, the V2EX site-wide trending list, the
                Gitee GVP Most Valuable Open Source Project award and a homepage feature on SSPAI, making it the free English learning app
                of choice for more than 100,000 users
              </p>
            </div>

            {/* main awards showcase */}
            <div className="mb-16 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-2xl border border-orange-200 bg-orange-50 p-6 text-center shadow-lg sm:p-8">
                <div className="mb-4 inline-flex items-center justify-center rounded-full bg-orange-100 p-4">
                  <svg className="h-8 w-8 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
                <h3 className="mb-2 text-lg font-bold text-gray-900 sm:text-xl">GitHub Trending</h3>
                <p className="text-sm text-gray-600 sm:text-base">#1 on the global trending list</p>
              </div>

              <div className="rounded-2xl border border-red-200 bg-red-50 p-8 text-center shadow-lg">
                <div className="mb-4 inline-flex items-center justify-center rounded-full bg-red-100 p-4">
                  <svg className="h-8 w-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z"
                    />
                  </svg>
                </div>
                <h3 className="mb-2 text-lg font-bold text-gray-900 sm:text-xl">V2EX Trending</h3>
                <p className="text-sm text-gray-600 sm:text-base">A site-wide trending project on V2EX</p>
              </div>

              <div className="rounded-2xl border border-green-200 bg-green-50 p-8 text-center shadow-lg">
                <div className="mb-4 inline-flex items-center justify-center rounded-full bg-green-100 p-4">
                  <svg className="h-8 w-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z"
                    />
                  </svg>
                </div>
                <h3 className="mb-2 text-lg font-bold text-gray-900 sm:text-xl">Gitee GVP</h3>
                <p className="text-sm text-gray-600 sm:text-base">Most Valuable Open Source Project</p>
              </div>

              <div className="rounded-2xl border border-blue-200 bg-blue-50 p-8 text-center shadow-lg">
                <div className="mb-4 inline-flex items-center justify-center rounded-full bg-blue-100 p-4">
                  <svg className="h-8 w-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                    />
                  </svg>
                </div>
                <h3 className="mb-2 text-lg font-bold text-gray-900 sm:text-xl">SSPAI Pick</h3>
                <p className="text-sm text-gray-600 sm:text-base">Featured on the SSPAI homepage</p>
              </div>
            </div>

            {/* detailed awards list */}
            <div className="grid gap-6 lg:grid-cols-2">
              <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-lg sm:p-8">
                <h3 className="mb-6 text-xl font-bold text-gray-900 sm:text-2xl">Open source community recognition</h3>
                <div className="space-y-4">
                  <div className="flex items-center gap-3 rounded-lg border border-gray-100 bg-gray-50 p-3 sm:gap-4 sm:p-4">
                    <div className="flex-shrink-0 rounded-full bg-orange-100 p-2">
                      <svg className="h-5 w-5 text-orange-600" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                      </svg>
                    </div>
                    <div>
                      <div className="font-semibold text-gray-900">#1 on GitHub Trending worldwide</div>
                      <div className="text-sm text-gray-600">The highest attention and recognition from developers worldwide</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 rounded-lg border border-gray-100 bg-gray-50 p-3 sm:gap-4 sm:p-4">
                    <div className="flex-shrink-0 rounded-full bg-green-100 p-2">
                      <svg className="h-5 w-5 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                      </svg>
                    </div>
                    <div>
                      <div className="font-semibold text-gray-900">Gitee Most Valuable Open Source Project (GVP)</div>
                      <div className="text-sm text-gray-600">A top-tier open source certification in China</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 rounded-lg border border-gray-100 bg-gray-50 p-3 sm:gap-4 sm:p-4">
                    <div className="flex-shrink-0 rounded-full bg-purple-100 p-2">
                      <svg className="h-5 w-5 text-purple-600" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                      </svg>
                    </div>
                    <div>
                      <div className="font-semibold text-gray-900">GitCode G-Star program graduate project</div>
                      <div className="text-sm text-gray-600">An outstanding project in the open source star program</div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-lg sm:p-8">
                <h3 className="mb-6 text-xl font-bold text-gray-900 sm:text-2xl">Media &amp; platform recommendations</h3>
                <div className="space-y-4">
                  <div className="flex items-center gap-3 rounded-lg border border-gray-100 bg-gray-50 p-3 sm:gap-4 sm:p-4">
                    <div className="flex-shrink-0 rounded-full bg-red-100 p-2">
                      <svg className="h-5 w-5 text-red-600" fill="currentColor" viewBox="0 0 20 20">
                        <path
                          fillRule="evenodd"
                          d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z"
                          clipRule="evenodd"
                        />
                      </svg>
                    </div>
                    <div>
                      <div className="font-semibold text-gray-900">V2EX site-wide trending project</div>
                      <div className="text-sm text-gray-600">Widely followed and discussed in the tech community</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 rounded-lg border border-gray-100 bg-gray-50 p-3 sm:gap-4 sm:p-4">
                    <div className="flex-shrink-0 rounded-full bg-blue-100 p-2">
                      <svg className="h-5 w-5 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                        <path
                          fillRule="evenodd"
                          d="M12.586 4.586a2 2 0 112.828 2.828l-3 3a2 2 0 01-2.828 0 1 1 0 00-1.414 1.414 4 4 0 005.656 0l3-3a4 4 0 00-5.656-5.656l-1.5 1.5a1 1 0 101.414 1.414l1.5-1.5zm-5 5a2 2 0 012.828 0 1 1 0 101.414-1.414 4 4 0 00-5.656 0l-3 3a4 4 0 105.656 5.656l1.5-1.5a1 1 0 10-1.414-1.414l-1.5 1.5a2 2 0 11-2.828-2.828l3-3z"
                          clipRule="evenodd"
                        />
                      </svg>
                    </div>
                    <div>
                      <div className="font-semibold text-gray-900">SSPAI homepage pick</div>
                      <div className="text-sm text-gray-600">Recognized by a quality app recommendation platform</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 rounded-lg border border-gray-100 bg-gray-50 p-3 sm:gap-4 sm:p-4">
                    <div className="flex-shrink-0 rounded-full bg-gray-100 p-2">
                      <svg className="h-5 w-5 text-gray-600" fill="currentColor" viewBox="0 0 20 20">
                        <path
                          fillRule="evenodd"
                          d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z"
                          clipRule="evenodd"
                        />
                      </svg>
                    </div>
                    <div>
                      <div className="font-semibold text-gray-900">Gitee site-wide featured project</div>
                      <div className="text-sm text-gray-600">Recommended by a leading Chinese code hosting platform</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* user statistics */}
            <div className="mt-16 rounded-2xl border border-indigo-200 bg-gradient-to-r from-indigo-50 to-purple-50 p-6 text-center sm:p-8">
              <h3 className="mb-6 text-xl font-bold text-gray-900 sm:mb-8 sm:text-2xl">Trusted by users, proven by the numbers</h3>
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-3 sm:gap-8">
                <div>
                  <div className="mb-2 text-3xl font-bold text-indigo-600 sm:text-4xl">20000+</div>
                  <div className="text-sm text-gray-600 sm:text-base">GitHub Stars</div>
                  <div className="text-xs text-gray-500 sm:text-sm">Broad recognition from developers</div>
                </div>
                <div>
                  <div className="mb-2 text-3xl font-bold text-indigo-600 sm:text-4xl">100000+</div>
                  <div className="text-sm text-gray-600 sm:text-base">Monthly active users</div>
                  <div className="text-xs text-gray-500 sm:text-sm">Learners who keep coming back</div>
                </div>
                <div>
                  <div className="mb-2 text-3xl font-bold text-indigo-600 sm:text-4xl">100+</div>
                  <div className="text-sm text-gray-600 sm:text-base">Community contributors</div>
                  <div className="text-xs text-gray-500 sm:text-sm">Building the project together</div>
                </div>
              </div>
            </div>

            <div className="mt-12 text-center sm:mt-16">
              <div className="mb-8">
                <h4 className="mb-4 text-xl font-bold text-gray-900 sm:text-2xl">Join our community</h4>
                <p className="mx-auto max-w-2xl text-sm text-gray-600 sm:text-base">
                  Become one of tens of thousands of users, try this highly regarded English learning tool and improve both your typing
                  skills and your English
                </p>
              </div>
              <a
                href="/"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-full bg-indigo-600 px-8 py-4 font-semibold text-white transition-all duration-300 hover:bg-indigo-700 hover:shadow-lg"
              >
                <span>Join the community now</span>
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 8l4 4m0 0l-4 4m4-4H3" />
                </svg>
              </a>
            </div>
          </div>
        </section>

        <section className="relative mt-24 w-full overflow-hidden py-24 lg:mt-32 lg:py-32">
          <div className="absolute inset-0 bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900"></div>
          <div className="absolute inset-0 bg-gradient-to-t from-black/10 to-transparent"></div>
          <div className="absolute inset-0">
            <div className="absolute -left-4 top-0 h-96 w-96 animate-pulse rounded-full bg-white/5 opacity-50 mix-blend-multiply blur-3xl filter"></div>
            <div
              className="absolute -right-4 top-0 h-96 w-96 animate-pulse rounded-full bg-white/5 opacity-50 mix-blend-multiply blur-3xl filter"
              style={{ animationDelay: '2s' }}
            ></div>
            <div
              className="absolute -bottom-8 left-20 h-96 w-96 animate-pulse rounded-full bg-white/5 opacity-50 mix-blend-multiply blur-3xl filter"
              style={{ animationDelay: '4s' }}
            ></div>
          </div>
          <div className="relative z-10 flex flex-col items-center justify-center px-6 text-center">
            <h2 className="mb-8 text-5xl font-bold leading-tight tracking-tight text-white lg:text-6xl xl:text-7xl">
              Start <span className="text-indigo-300">Now</span>
            </h2>
            <p className="mb-12 max-w-4xl text-xl font-light leading-relaxed text-white/80 lg:text-2xl">
              Begin your English learning journey and make every keystroke count as progress
            </p>
            <div className="flex flex-col items-center gap-4 sm:flex-row">
              <a
                href="/"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:shadow-3xl group relative overflow-hidden rounded-full bg-white px-12 py-5 text-xl font-semibold text-gray-900 shadow-2xl transition-all duration-300 hover:-translate-y-1 hover:scale-105"
              >
                <span className="relative z-10">Start learning →</span>
                <div className="absolute inset-0 bg-gradient-to-r from-gray-100 to-gray-50 opacity-0 transition-opacity duration-300 group-hover:opacity-100"></div>
              </a>
              <div className="flex items-center gap-2 text-sm font-light text-white/60 lg:hidden">
                <span>We recommend visiting with a desktop browser</span>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  )
}

export default MobilePage
