import { BrowserWindow, screen } from 'electron'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

let assistantWindow: BrowserWindow | null = null
const mainDir = path.dirname(fileURLToPath(import.meta.url))
const ASSISTANT_WIDTH = 560
const ASSISTANT_HEIGHT = 460
const COVER_WIDTH = 220
const COVER_HEIGHT = 28
let assistantCollapsed = false

function getRendererUrlOrFile(hash?: string): { url?: string; file?: string } {
  const devServerUrl = process.env['ELECTRON_RENDERER_URL']
  if (devServerUrl) {
    return { url: hash ? `${devServerUrl}/#${hash}` : devServerUrl }
  }
  return { file: path.join(mainDir, '../renderer/index.html') }
}

function preloadPath(): string {
  return path.join(mainDir, '../preload/index.js')
}

/**
 * The renderer exposes IPC methods that can read captured context and write text back to the
 * active application. Keep that API confined to the bundled renderer (or the configured Vite
 * origin in development); an external navigation must never inherit this preload bridge.
 */
export function isTrustedAssistantNavigation(
  targetUrl: string,
  rendererUrl = process.env['ELECTRON_RENDERER_URL'],
  bundledRendererPath = path.join(mainDir, '../renderer/index.html')
): boolean {
  try {
    const target = new URL(targetUrl)
    if (rendererUrl) {
      const renderer = new URL(rendererUrl)
      return target.origin === renderer.origin && target.pathname === renderer.pathname
    }

    return target.protocol === 'file:' && fileURLToPath(target) === bundledRendererPath
  } catch {
    return false
  }
}

function currentWorkArea(): { x: number; y: number; width: number; height: number } {
  const display = screen.getDisplayNearestPoint(screen.getCursorScreenPoint())
  return display.workArea
}

export function createAssistantWindow(): BrowserWindow {
  if (assistantWindow && !assistantWindow.isDestroyed()) return assistantWindow

  const { x, y, width } = currentWorkArea()
  const windowX = Math.round(x + (width - ASSISTANT_WIDTH) / 2)
  const windowY = Math.round(y + 12)

  assistantWindow = new BrowserWindow({
    width: ASSISTANT_WIDTH,
    height: ASSISTANT_HEIGHT,
    x: windowX,
    y: windowY,
    frame: false,
    alwaysOnTop: true,
    transparent: true,
    resizable: false,
    show: false,
    skipTaskbar: true,
    hasShadow: false,
    webPreferences: {
      preload: preloadPath(),
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  const target = getRendererUrlOrFile()
  if (target.url) {
    void assistantWindow.loadURL(target.url)
  } else if (target.file) {
    void assistantWindow.loadFile(target.file)
  }

  assistantWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  assistantWindow.webContents.on('will-navigate', (event, url) => {
    if (!isTrustedAssistantNavigation(url)) event.preventDefault()
  })

  assistantWindow.on('closed', () => {
    assistantWindow = null
  })

  return assistantWindow
}

export function showAssistantWindow(): void {
  expandAssistantWindow()
}

function expandedBounds(): { x: number; y: number; width: number; height: number } {
  const { x, y, width } = currentWorkArea()
  return {
    x: Math.round(x + (width - ASSISTANT_WIDTH) / 2),
    y: Math.round(y + 12),
    width: ASSISTANT_WIDTH,
    height: ASSISTANT_HEIGHT
  }
}

function collapsedBounds(): { x: number; y: number; width: number; height: number } {
  const { x, y, width } = currentWorkArea()
  return {
    x: Math.round(x + (width - COVER_WIDTH) / 2),
    y: y,
    width: COVER_WIDTH,
    height: COVER_HEIGHT
  }
}

function syncCollapsedState(collapsed: boolean): void {
  assistantWindow?.webContents.send('window:collapsed-changed', collapsed)
}

export function expandAssistantWindow(): void {
  const win = createAssistantWindow()
  assistantCollapsed = false
  win.setBounds(expandedBounds())
  syncCollapsedState(false)
  win.show()
  win.focus()
}

export function hideAssistantWindow(): void {
  if (assistantWindow && !assistantWindow.isDestroyed()) {
    assistantCollapsed = true
    assistantWindow.setBounds(collapsedBounds())
    syncCollapsedState(true)
    assistantWindow.showInactive()
  }
}

export function getAssistantWindow(): BrowserWindow | null {
  return assistantWindow
}

export function openAssistantSettings(): void {
  expandAssistantWindow()
  assistantWindow?.webContents.send('view:navigate', 'settings')
}

export function openAssistantHome(): void {
  expandAssistantWindow()
  assistantWindow?.webContents.send('view:navigate', 'assistant')
}

export function isAssistantCollapsed(): boolean {
  return assistantCollapsed
}
