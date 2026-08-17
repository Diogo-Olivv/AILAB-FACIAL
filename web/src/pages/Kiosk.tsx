import { Link } from "react-router-dom";

export function Kiosk() {
  return (
    <div className="grid min-h-screen place-items-center bg-base px-4 text-center">
      <div className="space-y-3">
        <h1 className="text-2xl font-semibold text-white">Kiosk de reconhecimento</h1>
        <p className="text-white/60">
          Tela do tablet (botao Entrada/Saida + confirmacao facial). Proximo passo.
        </p>
        <Link to="/dashboard" className="text-accent hover:underline">
          Voltar ao painel
        </Link>
      </div>
    </div>
  );
}
