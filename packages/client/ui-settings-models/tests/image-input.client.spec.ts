import { describe, expect, it } from 'vitest'
import { IMAGE_INPUT, acceptsImages, withImageInput } from '../src/client/image-input.ts'

describe('acceptsImages', () => {
  it('is true only for an array that contains image', () => {
    expect(acceptsImages(['text', 'image'])).toBe(true)
    expect(acceptsImages(['text'])).toBe(false)
    expect(acceptsImages([])).toBe(false)
    expect(acceptsImages(undefined)).toBe(false)
    expect(acceptsImages('image')).toBe(false)
  })
})

describe('withImageInput', () => {
  it('declares IMAGE_INPUT on the named field when enabled', () => {
    expect(withImageInput({ id: 'kept', name: 'Kept' }, 'input', true)).toEqual({
      id: 'kept',
      name: 'Kept',
      input: [...IMAGE_INPUT],
    })
    expect(withImageInput({ id: 'flash' }, 'inputModalities', true)).toEqual({
      id: 'flash',
      inputModalities: [...IMAGE_INPUT],
    })
  })

  it('removes the named field when disabled', () => {
    expect(withImageInput({ id: 'kept', input: [...IMAGE_INPUT] }, 'input', false)).toEqual({ id: 'kept' })
    expect(withImageInput(
      { id: 'flash', inputModalities: [...IMAGE_INPUT] },
      'inputModalities',
      false,
    )).toEqual({ id: 'flash' })
  })
})
