import { Component } from 'react';

/**
 * Red de seguridad: si algo dentro falla al renderizar (por ejemplo, una
 * vacante con datos incompletos en la pestaña Contacto), en vez de romperse
 * toda la pantalla se muestra un aviso y el resto de la app sigue funcionando.
 *
 * Uso:
 *   <ErrorBoundary onReset={...}>
 *     <Componente />
 *   </ErrorBoundary>
 */
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    console.error('ErrorBoundary capturó un error:', error, info);
  }

  handleClose = () => {
    this.setState({ hasError: false });
    if (this.props.onReset) this.props.onReset();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="modal-backdrop fade show">
          <div
            style={{
              position: 'fixed',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              background: '#fff',
              borderRadius: '12px',
              padding: '24px',
              maxWidth: '420px',
              textAlign: 'center',
              boxShadow: '0 10px 40px rgba(0,0,0,0.2)',
              zIndex: 1060,
            }}
          >
            <i
              className="bi bi-exclamation-triangle"
              style={{ fontSize: '2rem', color: '#d9822b' }}
            ></i>
            <h5 className="mt-2">No se ha podido cargar esta ficha</h5>
            <p className="text-muted mb-3">
              Ha ocurrido un problema al mostrar los datos de esta vacante. El
              resto de la aplicación sigue funcionando con normalidad.
            </p>
            <button
              className="btn btn-secondary-custom"
              onClick={this.handleClose}
            >
              Cerrar
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
