const countChangedEvent = 'question-bank-count-changed'

export function notifyQuestionBankCountChanged() {
  window.dispatchEvent(new Event(countChangedEvent))
}

export { countChangedEvent }
