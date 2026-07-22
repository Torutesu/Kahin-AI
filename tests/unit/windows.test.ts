import test from 'node:test'
import assert from 'node:assert/strict'
import { pathToFileURL, fileURLToPath } from 'node:url'
import { isTrustedAssistantNavigation } from '../../src/main/windows.ts'

test('allows only the configured renderer URL in development', () => {
  const rendererUrl = 'http://localhost:5173/'

  assert.equal(isTrustedAssistantNavigation('http://localhost:5173/#settings', rendererUrl), true)
  assert.equal(isTrustedAssistantNavigation('http://localhost:5173/other', rendererUrl), false)
  assert.equal(isTrustedAssistantNavigation('https://example.com/', rendererUrl), false)
})

test('allows only the bundled renderer file in production', () => {
  const rendererFile = fileURLToPath(new URL('../../src/renderer/index.html', import.meta.url))
  const rendererUrl = pathToFileURL(rendererFile).href

  assert.equal(isTrustedAssistantNavigation(rendererUrl, '', rendererFile), true)
  assert.equal(isTrustedAssistantNavigation('file:///tmp/untrusted.html', '', rendererFile), false)
  assert.equal(isTrustedAssistantNavigation('https://example.com/', '', rendererFile), false)
})
