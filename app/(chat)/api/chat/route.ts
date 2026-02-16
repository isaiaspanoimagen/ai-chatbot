import { createOpenAI } from '@ai-sdk/openai';
import { streamText } from 'ai';
import { auth } from '@/app/(auth)/auth';
import { saveChat, saveMessages } from '@/lib/db/queries';
import { generateUUID } from '@/lib/utils';

// Configuración de Ollama
const localOllama = createOpenAI({
  baseURL: 'http://localhost:11434/v1',
  apiKey: 'ollama',
});

// NOTA: 'export const dynamic' eliminado para evitar conflictos con next.config.ts
export const maxDuration = 60;

// HELPER: Extrae texto de cualquier estructura de forma segura
function extractTextFromMessage(content: any): string {
  if (!content) return '';
  
  // 1. Si es string puro
  if (typeof content === 'string') return content;
  
  // 2. Si es un array (multimodal / parts)
  if (Array.isArray(content)) {
    return content
      .map((part: any) => {
        if (typeof part === 'string') return part;
        // Buscamos la propiedad text en varios lugares comunes
        if (part?.type === 'text' && typeof part.text === 'string') return part.text;
        if (typeof part?.content === 'string') return part.content;
        return '';
      })
      .join('\n'); // Unimos con saltos de línea
  }
  
  // 3. Si es un objeto raro, intentamos stringify (debugging)
  try {
    return JSON.stringify(content);
  } catch (e) {
    return '';
  }
}

export async function POST(req: Request) {
  // 1. Recibimos datos
  const { id, messages = [] } = await req.json();

  const session = await auth();
  if (!session || !session.user) {
    return new Response('Unauthorized', { status: 401 });
  }

  // 2. Limpieza de mensajes (LA CORRECCIÓN CLAVE)
  const coreMessages = messages.map((m: any) => {
    // Buscamos el contenido en 'content' O en 'parts' (fallback)
    // El operador ?? asegura que si content es undefined, usemos parts
    const rawContent = m.content ?? m.parts;
    const cleanContent = extractTextFromMessage(rawContent);
    
    return {
      role: m.role,
      content: cleanContent,
    };
  });

  // DEBUG: Ver en la terminal qué llega exactamente
  const lastMessage = coreMessages[coreMessages.length - 1];
  console.log('--- NUEVA PETICIÓN CORREGIDA ---');
  console.log('ID Chat:', id);
  console.log('Mensajes recibidos:', messages.length);
  // console.log('Contenido último mensaje (Crudo):', JSON.stringify(messages[messages.length - 1]));
  console.log('Contenido último mensaje (Procesado):', lastMessage?.content);

  // 3. VALIDACIÓN RELAJADA
  // Si sigue vacío tras buscar en 'parts', ponemos un placeholder.
  if (!lastMessage?.content || lastMessage.content.trim() === '') {
    console.log('⚠️ ALERTA: Mensaje sigue vacío tras procesar. Usando placeholder.');
    lastMessage.content = '(El usuario envió un mensaje vacío o un archivo sin texto)';
  }

  // 4. Guardado preventivo del Chat
  try {
    await saveChat({
      id,
      userId: session.user.id!,
      title: lastMessage.content.slice(0, 50),
      visibility: 'private',
    });
  } catch (error) {
    // Ignoramos si ya existe
  }

  // 5. Generación con Streaming
  const result = streamText({
    model: localOllama('llama3'),
    messages: coreMessages,
    system: "Eres un asistente útil y directo. Respondes siempre en español.",
    
    onFinish: async ({ response }) => {
      const generatedMessage = response.messages[0];
      const generatedContent = extractTextFromMessage(generatedMessage.content);
      const userContent = lastMessage.content; // Usamos el contenido limpio

      if (!generatedContent) return;

      await saveMessages({
        messages: [
          {
            id: generateUUID(),
            chatId: id,
            role: 'user',
            // Guardamos siempre como array de objetos texto para evitar errores en frontend
            parts: [{ type: 'text', text: userContent }], 
            attachments: [], 
            createdAt: new Date(),
          },
          {
            id: generateUUID(),
            chatId: id,
            role: 'assistant',
            parts: [{ type: 'text', text: generatedContent }],
            attachments: [],
            createdAt: new Date(),
          },
        ],
      });
    },
  });

  // Usamos toTextStreamResponse para máxima compatibilidad
  return result.toTextStreamResponse();
}