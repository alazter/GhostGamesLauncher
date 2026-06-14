# <img src="public/logo.png" width="40" height="40" align="center" /> Ghost Games Launcher

[![GitHub release](https://img.shields.io/github/v/release/alazter/GhostGamesLauncher?style=for-the-badge)](https://github.com/alazter/GhostGamesLauncher/releases/latest)
[![GitHub all releases](https://img.shields.io/github/downloads/alazter/GhostGamesLauncher/total?style=for-the-badge&color=00B000)](https://github.com/alazter/GhostGamesLauncher/releases/)
[![GPLv3 license](https://img.shields.io/github/license/alazter/GhostGamesLauncher?style=for-the-badge&color=blue)](https://github.com/alazter/GhostGamesLauncher/blob/main/COPYING)  

Ghost Games Launcher is an Open Source Game Launcher for Windows based on the excellent [Heroic Games Launcher](https://github.com/Heroic-Games-Launcher/HeroicGamesLauncher).  
Right now it supports launching games from the Epic Games Store using [Legendary](https://github.com/derrod/legendary), GOG Games using implementation with [gogdl](https://github.com/Heroic-Games-Launcher/heroic-gogdl) and Amazon Games using [Nile](https://github.com/imLinguin/nile).

Ghost Games Launcher is built with Web Technologies:  
[![Typescript](https://img.shields.io/badge/Typescript-3178c6?style=for-the-badge&logo=typescript&labelColor=gray)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-5fd9fb?style=for-the-badge&logo=react&labelColor=gray)](https://reactjs.org/)
[![MUI](https://img.shields.io/badge/MUI-66b2ff?style=for-the-badge&logo=mui&labelColor=gray&logoColor=66b2ff)](https://mui.com/)
[![NodeJS](https://img.shields.io/badge/NodeJS-689f63?style=for-the-badge&logo=nodedotjs&labelColor=gray)](https://nodejs.org/)
[![Electron](https://img.shields.io/badge/Electron-4078c0?style=for-the-badge&logo=electron&labelColor=gray)](https://www.electronjs.org/)
[![electron-builder](https://img.shields.io/badge/electron--builder-4078c0?style=for-the-badge&logo=electronbuilder&labelColor=gray&logoColor=4078c0)](https://www.electron.build/)
[![Jest](https://img.shields.io/badge/Jest-18DF16?style=for-the-badge&logo=jest&labelColor=gray&logoColor=18DF16)](https://jestjs.io/)
[![Vite](https://img.shields.io/badge/Vite-BD34FE?style=for-the-badge&logo=vite&labelColor=gray)](https://vitejs.dev/)
  
  - [Credits](#credits)

## Features available right now

- Login with an existing Epic Games, GOG or Amazon account
- Install, uninstall, update, repair and move Games
- Import an already installed game
- Play Epic games online [AntiCheat on macOS and on Linux depends on the game]
- Play games using Wine or Proton [Linux]
- Play games using Crossover [macOS]
- Download custom Wine and Proton versions [Linux]
- Access to Epic, GOG and Amazon Games stores directly from Heroic
- Search for the game on ProtonDB for compatibility information [Linux]
- Show ProtonDB and Steam Deck compatibility information [Linux]
- Sync installed games with an existing Epic Games Store installation
- Sync saves with the cloud
- Custom Theming Support
- Download queue
- Add Games and Applications outside GOG, Epic Games and Amazon Games
- Define your categories to organize your collection

<details>
  <summary>Expand</summary>

- English
- Portuguese (Brazil)

## Credits

### Heroic Games Launcher
This project is a customized fork and rebranding of the excellent [Heroic Games Launcher](https://github.com/Heroic-Games-Launcher/HeroicGamesLauncher). All credits for the core launcher code, design, and initial implementations go to the Heroic team and all its open-source contributors. We are immensely grateful for their work.

### Weblate: Localization platform

- URL: https://weblate.org/en/

### Those Awesome Guys: Gamepad prompts images

- URL: https://thoseawesomeguys.com/prompts/

[![jump](https://img.shields.io/badge/Back%20to%20top-%20?style=flat&color=grey&logo=data:image/svg%2bxml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIGhlaWdodD0iMjRweCIgdmlld0JveD0iMCAwIDI0IDI0IiB3aWR0aD0iMjRweCIgZmlsbD0iI0ZGRkZGRiI+PHBhdGggZD0iTTAgMGgyNHYyNEgwVjB6IiBmaWxsPSJub25lIi8+PHBhdGggZD0iTTQgMTJsMS40MSAxLjQxTDExIDcuODNWMjBoMlY3LjgzbDUuNTggNS41OUwyMCAxMmwtOC04LTggOHoiLz48L3N2Zz4=)](#heroic-games-launcher)

### Tools We Use to Run Games

Ghost Games Launcher would not be possible without the work done in many other projects:

- Heroic Games Launcher: https://github.com/Heroic-Games-Launcher/HeroicGamesLauncher
- Legendary: https://github.com/derrod/legendary (we use [a fork of it](https://github.com/Heroic-Games-Launcher/legendary))
- GOGdl: https://github.com/Heroic-Games-Launcher/heroic-gogdl
- Nile: https://github.com/imLinguin/nile
- Comet: https://github.com/imLinguin/comet
- GE-Proton: https://github.com/GloriousEggroll/proton-ge-custom
- umu-launcher: https://github.com/Open-Wine-Components/umu-launcher
- DXVK: https://github.com/doitsujin/dxvk
- VKD3D: https://github.com/HansKristian-Work/vkd3d-proton
- Game-Porting-Toolkit: https://github.com/Gcenx/game-porting-toolkit
- Wine-Staging: https://github.com/Gcenx/macOS_Wine_builds
- Wine-Crossover: https://github.com/Gcenx/winecx
- DXVK-MacOS: https://github.com/Gcenx/DXVK-macOS
- DXMT: https://github.com/3Shain/dxmt
- Heroic-Epic integration exe: https://github.com/Etaash-mathamsetty/heroic-epic-integration
- vulkan helper: https://github.com/imLinguin/vulkan-helper-rs

So be sure to follow and support those projects too!
