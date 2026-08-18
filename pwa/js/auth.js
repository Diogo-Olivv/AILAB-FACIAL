// Gate de acesso do kiosk: so o owner (dispositivo do laboratorio) entra.
// Mostra um overlay de login e resolve quando ha uma sessao de owner valida.

import { getUsuario, ehOwner, entrar } from "./db.js";
import { OWNER_EMAIL } from "./config.js";

const overlay = document.getElementById("owner-login");
const senhaInput = document.getElementById("owner-senha");
const btnEntrar = document.getElementById("owner-btn");
const statusEl = document.getElementById("owner-status");

function mostrar() {
  overlay.classList.add("active");
  setTimeout(() => senhaInput.focus(), 50);
}

function esconder() {
  overlay.classList.remove("active");
}

function setStatus(msg, tipo = "") {
  statusEl.textContent = msg;
  statusEl.style.color = tipo === "warn" ? "var(--warn)" : "var(--muted)";
}

export async function garantirOwner() {
  const user = await getUsuario();
  if (ehOwner(user)) return user;

  mostrar();
  return new Promise((resolve) => {
    async function tentar() {
      const senha = senhaInput.value;
      if (!senha) {
        setStatus("Digite a senha.", "warn");
        return;
      }
      btnEntrar.disabled = true;
      setStatus("Entrando...");
      try {
        const logado = await entrar(OWNER_EMAIL, senha);
        if (!ehOwner(logado)) {
          setStatus("Esta conta nao tem acesso ao reconhecimento.", "warn");
          btnEntrar.disabled = false;
          return;
        }
        esconder();
        resolve(logado);
      } catch (err) {
        setStatus(err.message || "Falha no login.", "warn");
        btnEntrar.disabled = false;
      }
    }
    btnEntrar.addEventListener("click", tentar);
    senhaInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") tentar();
    });
  });
}
