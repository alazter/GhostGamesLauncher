import React, { useState } from 'react'
import { createRoot } from 'react-dom/client'
import { RELEASE_CATEGORIES } from '../../../src/common/types/releases'
import '../../../src/frontend/screens/Releases/native.css'
import ReleaseNavigation from '../../../src/frontend/screens/Releases/ReleaseNavigation'

function Fixture() {
  const [category, setCategory] = useState('games')
  const [tag, setTag] = useState('Action')
  const [platforms, setPlatforms] = useState(['PC'])
  const [theme, setTheme] = useState<'dark' | 'light'>('dark')
  return (
    <div className="App">
      <main className={`NativeReleases NativeReleases--${theme}`}>
        <ReleaseNavigation categories={RELEASE_CATEGORIES} category={category}
          platforms={platforms} tag={tag} region="us" theme={theme}
          tracking={false} tracked={[]} onCategory={setCategory}
          onPlatforms={setPlatforms} onTag={setTag} onRegion={() => {}}
          onTheme={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          onCalendar={() => {}} onSearch={() => {}} onTracking={() => {}} />
        <output id="state">{JSON.stringify({ category, tag, platforms, theme })}</output>
      </main>
    </div>
  )
}
createRoot(document.getElementById('root')!).render(<Fixture />)
