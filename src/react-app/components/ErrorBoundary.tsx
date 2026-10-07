import { Component, type ErrorInfo, type ReactNode } from "react";

interface ErrorBoundaryProps {
  children: ReactNode;
  /** Muda quando a rota muda: limpa o erro para a próxima tela poder abrir. */
  resetKey?: string;
}

interface ErrorBoundaryState {
  erro: Error | null;
}

/** Evita a tela branca: um erro de renderização numa página vira uma mensagem com "Tentar novamente". */
export default class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { erro: null };

  static getDerivedStateFromError(erro: Error): ErrorBoundaryState {
    return { erro };
  }

  componentDidCatch(erro: Error, info: ErrorInfo) {
    console.error("Erro ao renderizar a página:", erro, info.componentStack);
  }

  componentDidUpdate(anterior: ErrorBoundaryProps) {
    if (this.state.erro && anterior.resetKey !== this.props.resetKey) this.setState({ erro: null });
  }

  render() {
    if (!this.state.erro) return this.props.children;
    return (
      <div role="alert" className="mx-auto mt-16 max-w-md rounded-2xl border border-red-200 bg-white p-8 text-center shadow-sm">
        <h2 className="text-lg font-bold text-slate-800">Algo deu errado nesta tela</h2>
        <p className="mt-1 text-sm text-slate-500">{this.state.erro.message || "Erro inesperado."}</p>
        <div className="mt-4 flex justify-center gap-2">
          <button type="button" onClick={() => this.setState({ erro: null })} className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white hover:bg-blue-700">Tentar novamente</button>
          <button type="button" onClick={() => window.location.reload()} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-50">Recarregar a página</button>
        </div>
      </div>
    );
  }
}
