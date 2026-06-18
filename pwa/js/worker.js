importScripts('../vendor/face-api.min.js');

let modelsLoaded = false;

async function loadModels() {
  try {
    // A API permite carregar via URI ou carregar os JSON/shards diretamente.
    // Em worker, carregar URI relativo à raiz do servidor é mais seguro.
    await faceapi.nets.tinyFaceDetector.loadFromUri('/models');
    await faceapi.nets.faceLandmark68Net.loadFromUri('/models');
    await faceapi.nets.faceRecognitionNet.loadFromUri('/models');
    modelsLoaded = true;
    self.postMessage({ type: 'models_loaded' });
  } catch (e) {
    self.postMessage({ type: 'models_error', error: e.message });
  }
}

loadModels();

self.onmessage = async (e) => {
  if (!modelsLoaded) return;
  const { type, imageData, pessoas, threshold, inputSize } = e.data;
  
  if (type === 'recognize') {
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
  } else if (type === 'enroll') {
    const tensor = faceapi.tf.browser.fromPixels(imageData);
    const det = await faceapi
      .detectSingleFace(tensor, new faceapi.TinyFaceDetectorOptions({ inputSize }))
      .withFaceLandmarks()
      .withFaceDescriptor();
    tensor.dispose();
    self.postMessage({ type: 'enroll_result', descriptor: det ? Array.from(det.descriptor) : null });
  }
};
