export const bengaliNumber = (value) => Number(value).toLocaleString('bn-BD')
export const localizedNumber = (value, isEnglish) => isEnglish ? String(value) : bengaliNumber(value)
