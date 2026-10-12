import AppShell from './components/AppShell'
import CustomDictsSync from './components/CustomDictsSync'
import Loading from './components/Loading'
import './index.css'
import { ErrorBook } from './pages/ErrorBook'
import { FriendLinks } from './pages/FriendLinks'
import TypingGate from './pages/Typing/TypingGate'
import { isOpenDarkModeAtom } from '@/store'
import { Analytics } from '@vercel/analytics/react'
import 'animate.css'
import { useAtomValue } from 'jotai'
import mixpanel from 'mixpanel-browser'
import process from 'process'
import React, { Suspense, lazy, useEffect } from 'react'
import 'react-app-polyfill/stable'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'

const AnalysisPage = lazy(() => import('./pages/Analysis'))
const GalleryPage = lazy(() => import('./pages/Gallery-N'))
const MySetsPage = lazy(() => import('./pages/MySets'))
const SetEditorPage = lazy(() => import('./pages/MySets/SetEditor'))
const StudyPage = lazy(() => import('./pages/Study'))
const QuizPage = lazy(() => import('./pages/Quiz'))
const MatchPage = lazy(() => import('./pages/Match'))

if (process.env.NODE_ENV === 'production') {
  // for prod
  mixpanel.init('bdc492847e9340eeebd53cc35f321691')
} else {
  // for dev
  mixpanel.init('5474177127e4767124c123b2d7846e2a', { debug: true })
}

function Root() {
  const darkMode = useAtomValue(isOpenDarkModeAtom)
  useEffect(() => {
    darkMode ? document.documentElement.classList.add('dark') : document.documentElement.classList.remove('dark')
  }, [darkMode])

  return (
    <React.StrictMode>
      <BrowserRouter basename={REACT_APP_DEPLOY_ENV === 'pages' ? '/qwerty-learner' : ''}>
        <Suspense fallback={<Loading />}>
          <Routes>
            <Route element={<AppShell />}>
              <Route index element={<TypingGate />} />
              <Route path="/typing" element={<TypingGate />} />
              <Route path="/gallery" element={<GalleryPage />} />
              <Route path="/analysis" element={<AnalysisPage />} />
              <Route path="/error-book" element={<ErrorBook />} />
              <Route path="/my-sets" element={<MySetsPage />} />
              <Route path="/my-sets/:id" element={<SetEditorPage />} />
              <Route path="/study/:dictId" element={<StudyPage />} />
              <Route path="/quiz/:dictId" element={<QuizPage />} />
              <Route path="/match/:dictId" element={<MatchPage />} />
              <Route path="/friend-links" element={<FriendLinks />} />
              <Route path="/mobile" element={<Navigate to="/" replace />} />
              <Route path="/*" element={<Navigate to="/" />} />
            </Route>
          </Routes>
        </Suspense>
      </BrowserRouter>
      <CustomDictsSync />
      <Analytics />
    </React.StrictMode>
  )
}

const container = document.getElementById('root')

container && createRoot(container).render(<Root />)
