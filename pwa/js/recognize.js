// Captura um único frame da câmera e calcula match contra o conjunto de pessoas.
// Função pura: recebe `pessoas` e (opcionalmente) o vídeo; devolve top-3
// candidatos ordenados por distância (menor = mais parecido). Sem DOM.
//
// Por que top-3: na fallback de seleção manual, mostramos as 3 melhores
// sugestões no topo da lista. Reduz fricção quando o reconhecimento "erra
// por pouco" mas o candidato certo está entre os mais próximos.

import { Camera } from "./camera.js";

const INPUT_SIZE = 320;

export async function reconhecerUmaVez(pessoas, video = Camera.video) {
  if (!pessoas || pessoas.length === 0) {
    return { box: null, melhor: null, top3: [] };
  }

  let tensor = null;
  try {
    tensor = faceapi.tf.browser.fromPixels(video);
    const det = await faceapi
      .detectSingleFace(tensor, new faceapi.TinyFaceDetectorOptions({ inputSize: INPUT_SIZE }))
      .withFaceLandmarks()
      .withFaceDescriptor();

    if (!det) return { box: null, melhor: null, top3: [] };

    const ranking = pessoas
      .map((p) => ({ nome: p.nome, dist: faceapi.euclideanDistance(det.descriptor, p.embedding) }))
      .sort((a, b) => a.dist - b.dist);

    return {
      box: det.detection.box,
      melhor: ranking[0],
      top3: ranking.slice(0, 3),
    };
  } finally {
    if (tensor) tensor.dispose();
  }
}
