import { NotFoundError } from 'elysia'

export const errorHandler = (error: Error) => {
  if (error instanceof NotFoundError) {
    return {
      status: 404,
      message: 'Страница не найдена',
      error: 'NOT_FOUND'
    }
  }
  
  return {
    status: 500,
    message: 'Внутренняя ошибка сервера',
    error: error.message
  }
} 