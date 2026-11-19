export interface ValidationResult {
  isValid: boolean;
  isEmpty: boolean;
  isNumeric: boolean;
  message: string;
}

export function validateNumericAnswer(userInput: string, expectedAnswer: number): ValidationResult {
  const trimmed = userInput.trim();

  if (trimmed === '') {
    return {
      isValid: false,
      isEmpty: true,
      isNumeric: false,
      message: 'Поле чекає на ваш запис. Перевірте обчислення у чернетці!',
    };
  }

  const parsedValue = Number(trimmed);
  if (isNaN(parsedValue)) {
    return {
      isValid: false,
      isEmpty: false,
      isNumeric: false,
      message: 'Будь ласка, вкажіть лише числове значення результату.',
    };
  }

  if (parsedValue === expectedAnswer) {
    return {
      isValid: true,
      isEmpty: false,
      isNumeric: true,
      message: 'Чудово! Розрахунок виконано правильно!',
    };
  }

  return {
    isValid: false,
    isEmpty: false,
    isNumeric: true,
    message: 'Результат потребує уточнення. Перевірте обчислення або скористайтеся підказкою.',
  };
}

export function validateTextAnswer(userInput: string, expectedAnswer: string | number): boolean {
  const cleanInput = userInput.trim().toLowerCase();
  const cleanExpected = String(expectedAnswer).trim().toLowerCase();
  return cleanInput === cleanExpected;
}

// Kept as alias for backwards compatibility
export const validateHistoryAnswer = validateTextAnswer;
