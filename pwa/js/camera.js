export const Camera = {
  video: document.getElementById("video"),
  overlay: document.getElementById("overlay"),
  stream: null,

  async abrir() {
    this.stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } },
      audio: false,
    });
    this.video.srcObject = this.stream;
    await new Promise((r) => (this.video.onloadedmetadata = r));
    await this.video.play();
    this.overlay.width = this.video.videoWidth;
    this.overlay.height = this.video.videoHeight;
  },

  getFrameData() {
    const canvas = document.createElement("canvas");
    canvas.width = this.video.videoWidth;
    canvas.height = this.video.videoHeight;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    ctx.drawImage(this.video, 0, 0, canvas.width, canvas.height);
    return ctx.getImageData(0, 0, canvas.width, canvas.height);
  },

  desenharBox(box, nome, isRecognized) {
    const ctx = this.overlay.getContext("2d");
    ctx.clearRect(0, 0, this.overlay.width, this.overlay.height);
    if (!box) return;
    const { x, y, width, height } = box;
    ctx.lineWidth = 3;
    ctx.strokeStyle = isRecognized ? "#4ad295" : "#ff6b6b";
    ctx.strokeRect(x, y, width, height);
    ctx.fillStyle = ctx.strokeStyle;
    ctx.font = "bold 22px sans-serif";
    ctx.fillText(nome || "?", x, y - 8);
  },

  limpar() {
    const ctx = this.overlay.getContext("2d");
    ctx.clearRect(0, 0, this.overlay.width, this.overlay.height);
  }
};
