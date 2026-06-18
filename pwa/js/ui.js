export const UI = {
  statusEl: document.getElementById("status"),
  toastEl: document.getElementById("toast"),
  enrollStatus: document.getElementById("enroll-status"),
  toastTimer: null,

  setStatus(msg, classe = "") {
    this.statusEl.textContent = msg;
    this.statusEl.className = classe;
  },

  setEnrollStatus(msg, classe = "") {
    this.enrollStatus.textContent = msg;
    this.enrollStatus.style.color = classe === "warn" ? "var(--warn)" : "var(--muted)";
  },

  mostrarToast(msg, sub = "", classe = "") {
    this.toastEl.innerHTML = sub
      ? `${msg}<span class="toast-sub">${sub}</span>`
      : msg;
    this.toastEl.className = classe === "warn" ? "show warn" : "show";
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => {
      this.toastEl.classList.remove("show");
    }, 3000);
  },
  
  formatarMinutos(min) {
    if (min < 60) return `${min} min`;
    const h = Math.floor(min / 60);
    const m = min % 60;
    return m ? `${h}h${String(m).padStart(2, "0")}` : `${h}h`;
  }
};
