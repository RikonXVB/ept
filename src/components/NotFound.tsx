import React from 'react'

export const NotFound: React.FC = () => {
  return React.createElement('div', {
    style: {
      display: 'flex',
      flexDirection: 'column' as const,
      alignItems: 'center',
      justifyContent: 'center',
      height: '100vh'
    }
  }, [
    React.createElement('h1', {
      key: 'title'
    }, '404 - Страница не найдена'),
    React.createElement('button', {
      key: 'button',
      onClick: () => { window.location.href = '/' }
    }, 'Вернуться на главную')
  ])
} 