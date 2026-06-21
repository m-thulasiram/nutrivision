import * as tf from "@tensorflow/tfjs";
import { bundleResourceIO, 
         decodeJpeg } from "@tensorflow/tfjs-react-native";

let isReady = false;

export async function initTF(): Promise<void> {
  if (isReady) return;
  await tf.ready();
  isReady = true;
}

export function isTFReady(): boolean {
  return isReady;
}
