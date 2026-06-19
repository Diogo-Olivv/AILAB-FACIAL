self.window = self;
self.document = {
  createElement: (type) => {
    if (type === 'canvas' && typeof OffscreenCanvas !== 'undefined') {
      return new OffscreenCanvas(640, 480);
    }
    return {};
  }
};
importScripts('../vendor/face-api.min.js');

faceapi.env.monkeyPatch({
  fetch: self.fetch.bind(self),
  Canvas: typeof OffscreenCanvas !== 'undefined' ? OffscreenCanvas : class {},
  createCanvasElement: () => new OffscreenCanvas(640, 480),
  createImageElement: () => ({})
});

let modelsLoaded = false;
let modelsLoadError = "Ainda carregando...";

async function loadModels() {
  try {
    await faceapi.tf.setBackend('cpu');
    await faceapi.nets.tinyFaceDetector.loadFromUri('/models');
    await faceapi.nets.faceLandmark68Net.loadFromUri('/models');
    await faceapi.nets.faceRecognitionNet.loadFromUri('/models');
    modelsLoaded = true;
    self.postMessage({ type: 'models_loaded' });
  } catch (e) {
    modelsLoadError = String(e) + (e.stack ? "\n" + e.stack : "");
    self.postMessage({ type: 'models_error', error: modelsLoadError });
  }
}

loadModels();

self.onmessage = async (e) => {
  if (!modelsLoaded) {
    self.postMessage({ type: `${e.data.type}_error`, error: `Modelos não carregados. Motivo: ${modelsLoadError}` });
    return;
  }
  const { type, imageData, pessoas, threshold, inputSize } = e.data;
  
  if (type === 'recognize') {
    try {
      const tensor = faceapi.tf.browser.fromPixels(imageData);
      const det = await faceapi
        .detectSingleFace(tensor, new faceapi.TinyFaceDetectorOptions({ inputSize }))
        .withFaceLandmarks()
        .withFaceDescriptor();
      tensor.dispose();

      if (!det) {
        self.postMessage({ type: 'recognize_result', result: null });
        return;
      }
      
      let melhor = { nome: null, dist: Infinity };
      for (const p of pessoas) {
        let s = 0;
        for (let i = 0; i < p.embedding.length; i++) {
          const d = p.embedding[i] - det.descriptor[i];
          s += d * d;
        }
        const dist = Math.sqrt(s);
        if (dist < melhor.dist) melhor = { nome: p.nome, dist: dist };
      }
      
      self.postMessage({ 
        type: 'recognize_result', 
        result: { 
          box: det.detection.box, 
          melhor 
        } 
      });
    } catch (err) {
      self.postMessage({ type: 'recognize_result', result: null });
    }
  } else if (type === 'enroll') {
    try {
      const tensor = faceapi.tf.browser.fromPixels(imageData);
      const det = await faceapi
        .detectSingleFace(tensor, new faceapi.TinyFaceDetectorOptions({ inputSize }))
        .withFaceLandmarks()
        .withFaceDescriptor();
      tensor.dispose();
      self.postMessage({ type: 'enroll_result', descriptor: det ? Array.from(det.descriptor) : null });
    } catch (err) {
      self.postMessage({ type: 'enroll_error', error: "Inferência falhou: " + err.message });
    }
  }
};
