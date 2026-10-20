import { equationMarker } from '../../shared/mathFormatting.js'

export const isMathExpression = (value) => /[\^_=+*/√]|[a-zA-Z]\d/.test(value)
export const promptText = (value = '') => value.split(equationMarker).join('').replace(/\s+/g, ' ').trim()
