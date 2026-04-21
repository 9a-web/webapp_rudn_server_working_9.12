import React from 'react';

/**
 * ErrorBoundary — перехватывает ошибки в дочерних компонентах,
 * показывает fallback UI вместо крэша всего приложения.
 */
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('🔴 ErrorBoundary caught an error:', error, errorInfo);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      // Если передан кастомный fallback — используем его
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '40px 20px',
          textAlign: 'center',
          minHeight: '200px',
        }}>
          <div style={{
            fontSize: '48px',
            marginBottom: '16px',
          }}>
            ⚠️
          </div>
          <h3 style={{
            color: '#E8E8F0',
            fontSize: '18px',
            fontWeight: '600',
            marginBottom: '8px',
          }}>
            Что-то пошло не так
          </h3>
          <p style={{
            color: '#8B8B9E',
            fontSize: '14px',
            marginBottom: '20px',
            maxWidth: '300px',
          }}>
            Произошла ошибка при загрузке этого раздела. Попробуйте обновить.
          </p>
          <button
            onClick={this.handleRetry}
            style={{
              background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
              color: '#fff',
              border: 'none',
              borderRadius: '12px',
              padding: '10px 24px',
              fontSize: '14px',
              fontWeight: '500',
              cursor: 'pointer',
            }}
          >
            Попробовать снова
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
