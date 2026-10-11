import { useContext, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import GamesList from '../../src/frontend/screens/Library/components/GamesList'
import LibraryContext from '../../src/frontend/screens/Library/LibraryContext'
import '../../src/frontend/screens/Library/index.css'
import '../../src/frontend/screens/Library/components/GameCard/index.css'
import {
  LIBRARY_GO_TO_END_EVENT,
  LIBRARY_GO_TO_START_EVENT
} from '../../src/frontend/screens/Library/components/GamesList/libraryNavigation'

const games = Array.from({ length: 1463 }, (_, index) => ({
  app_name: `game-${index}`,
  title: `Jogo ${index}`,
  runner: 'sideload',
  is_installed: true,
  install: {},
  art_square:
    'data:image/svg+xml,' +
    encodeURIComponent(
      '<svg xmlns="http://www.w3.org/2000/svg" width="173" height="275"><rect width="173" height="275" fill="#136074"/></svg>'
    ),
  art_cover:
    'data:image/svg+xml,' +
    encodeURIComponent(
      '<svg xmlns="http://www.w3.org/2000/svg" width="173" height="275"><rect width="173" height="275" fill="#136074"/></svg>'
    )
}))

function Fixture() {
  const libraryContext = useContext(LibraryContext)
  const [library, setLibrary] = useState(games)
  const [layout, setLayout] = useState('grid')
  const [firstLane, setFirstLane] = useState(false)
  Object.assign(window, {
    libraryFixture: {
      setLibrary: (offset = 0, total = 1463) =>
        setLibrary(games.slice(offset, offset + total)),
      refreshMetadata: () =>
        setLibrary((current) =>
          current.map((game) => ({
            ...game,
            title: game.title + ' atualizado'
          }))
        ),
      setLayout,
      setFirstLane,
      goToEnd: () =>
        document
          .getElementById('games-scroll-area')!
          .dispatchEvent(
            new Event(LIBRARY_GO_TO_END_EVENT, { cancelable: true })
          ),
      goToStart: () =>
        document
          .getElementById('games-scroll-area')!
          .dispatchEvent(
            new Event(LIBRARY_GO_TO_START_EVENT, { cancelable: true })
          )
    }
  })
  return (
    <MemoryRouter>
      <LibraryContext.Provider value={{ ...libraryContext, layout }}>
        <div id="games-scroll-area" style={{ height: 600, overflowY: 'auto' }}>
          <GamesList
            library={library as never}
            layout={layout}
            isFirstLane={firstLane}
            handleGameCardClick={() => {}}
          />
        </div>
      </LibraryContext.Provider>
    </MemoryRouter>
  )
}

createRoot(document.getElementById('root')!).render(<Fixture />)
