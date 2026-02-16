import { createOpenAI } from '@ai-sdk/openai';
import { streamText } from 'ai';

// Configuración de Ollama
const localOllama = createOpenAI({
  baseURL: 'http://localhost:11434/v1',
  apiKey: 'ollama',
});

export const maxDuration = 60;

export async function POST(req: Request) {
  // 1. Recibimos los mensajes del frontend
  const { messages = [] } = await req.json();

  // 2. LIMPIEZA MANUAL (Sanitizer)
  // En lugar de usar 'convertToCoreMessages' que te da error,
  // recorremos el array nosotros mismos.
  const cleanMessages = messages.map((m: any) => {
    let textContent = '';

    // Si el contenido ya es texto, lo usamos tal cual
    if (typeof m.content === 'string') {
      textContent = m.content;
    } 
    // Si es un array (multimodal), extraemos solo las partes de texto
    else if (Array.isArray(m.content)) {
      textContent = m.content
        .filter((part: any) => part.type === 'text')
        .map((part: any) => part.text)
        .join('\n');
    }

    // Evitamos enviar mensajes vacíos que rompan a Ollama
    if (!textContent.trim()) {
      textContent = '(contenido omitido)';
    }

    // Devolvemos el objeto limpio que espera la IA
    return {
      role: m.role,
      content: textContent,
    };
  });

  // 3. Generamos la respuesta
  const result = streamText({
    model: localOllama('llama3'),
    messages: cleanMessages,
    system: "Eres un asistente útil y directo. Respondes siempre en español.",
  });

  // 4. Devolvemos la respuesta
  // Usamos el método que te sugirió el error anterior para máxima compatibilidad
  return result.toTextStreamResponse();
}